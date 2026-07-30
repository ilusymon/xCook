UPDATE users
SET coin_log = CASE
  WHEN JSON_TYPE(coin_log) = 'OBJECT' AND JSON_LENGTH(coin_log) > 0
    THEN JSON_ARRAY(coin_log)
  ELSE JSON_ARRAY()
END
WHERE JSON_TYPE(coin_log) <> 'ARRAY';
