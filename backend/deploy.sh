#!/usr/bin/env bash
#
# xCook 后端一键部署脚本
# 链路: 本地构建 Docker 镜像 -> 导出镜像 -> scp 上传镜像、Compose 和 .env
#       -> 服务器加载镜像 -> Compose 重启后端容器
#
# 用法: 在 backend 目录执行 ./deploy.sh
# 前提: 本地已安装 Docker、ssh、scp，并已配置服务器免密 SSH 登录
#

set -euo pipefail

# ============ 配置区（按需修改）============
SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="117.72.40.150"
SERVER_PORT="22"                              # SSH 端口
DEPLOY_DIR="/opt/xcook-api"               # 服务器部署目录
SERVICE="backend"                             # Compose 服务名
CONTAINER_NAME="xcook"                # 容器名
IMAGE_NAME="xcook-api:latest"             # 镜像名
REMOTE_IMAGE_NAME="xcook-api.tar"          # 服务器上的临时镜像包
TARGET_PLATFORM="linux/amd64"                 # ARM64 服务器改为 linux/arm64
# ============================================

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
LOCAL_IMAGE="${SCRIPT_DIR}/${REMOTE_IMAGE_NAME}"
REMOTE="${SERVER_USER}@${SERVER_HOST}"
SSH=(ssh -p "${SERVER_PORT}" "${REMOTE}")
SCP=(scp -P "${SERVER_PORT}")

if [ -z "${SERVER_HOST}" ]; then
  echo "!! 请通过 SERVER_HOST 环境变量指定部署服务器地址。"
  echo "   示例: SERVER_HOST=<服务器地址> ./deploy.sh"
  exit 1
fi

cleanup() {
  rm -f -- "${LOCAL_IMAGE}"
}
trap cleanup EXIT

for command in docker ssh scp; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "!! 找不到命令: ${command}"
    exit 1
  fi
done

if [ ! -f "${ENV_FILE}" ]; then
  echo "!! 找不到后端配置: ${ENV_FILE}"
  echo "   请先复制 .env.example 为 .env 并完成配置。"
  exit 1
fi

APP_PORT="$(sed -n 's/^[[:space:]]*APP_PORT[[:space:]]*=[[:space:]]*//p' "${ENV_FILE}" | tail -n 1 | tr -d '\r')"
APP_PORT="${APP_PORT:-8081}"
if ! [[ "${APP_PORT}" =~ ^[0-9]+$ ]] || [ "${APP_PORT}" -lt 1 ] || [ "${APP_PORT}" -gt 65535 ]; then
  echo "!! .env 中的 APP_PORT 不是有效端口: ${APP_PORT}"
  exit 1
fi

echo "==> [1/4] 本地构建 ${TARGET_PLATFORM} Docker 镜像..."
docker build \
  --platform "${TARGET_PLATFORM}" \
  --tag "${IMAGE_NAME}" \
  "${SCRIPT_DIR}"
echo "    镜像构建完成: ${IMAGE_NAME}"

echo "==> [2/4] 导出镜像包..."
docker image save --output "${LOCAL_IMAGE}" "${IMAGE_NAME}"
if [ ! -f "${LOCAL_IMAGE}" ]; then
  echo "!! 镜像导出失败: ${LOCAL_IMAGE}"
  exit 1
fi
echo "    镜像包已生成: ${LOCAL_IMAGE}"

echo "==> [3/4] 上传到 ${SERVER_HOST}:${DEPLOY_DIR} ..."
"${SSH[@]}" "mkdir -p -- '${DEPLOY_DIR}'"
"${SCP[@]}" \
  "${LOCAL_IMAGE}" \
  "${COMPOSE_FILE}" \
  "${ENV_FILE}" \
  "${REMOTE}:${DEPLOY_DIR}/"
echo "    上传完成。"

echo "==> [4/4] 服务器加载镜像并重启后端..."
"${SSH[@]}" "set -eu; \
  cd '${DEPLOY_DIR}'; \
  chmod 600 .env; \
  docker image load --input '${REMOTE_IMAGE_NAME}'; \
  docker compose up -d --no-build '${SERVICE}'; \
  rm -f -- '${REMOTE_IMAGE_NAME}'; \
  docker compose ps '${SERVICE}'"

echo ""
echo "==> 部署完成 ✅"
echo "    服务地址: http://${SERVER_HOST}:${APP_PORT}"
echo "    查看日志: ${SSH[*]} \"docker logs -f ${CONTAINER_NAME}\""
echo "    查看状态: ${SSH[*]} \"docker compose -f ${DEPLOY_DIR}/docker-compose.yml ps ${SERVICE}\""
