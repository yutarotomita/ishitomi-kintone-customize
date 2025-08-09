(function() {
  'use strict';

  // --- 設定項目 ---
  const APP_ID = 7; // この単価マスタアプリ自身のID
  const UNIT_PRICE_ID_FIELD = '数値_単価ID'; // 単価IDフィールドのコード

  // --- kintone イベントハンドラ ---
  // レコード追加画面の表示イベントのみを監視
  kintone.events.on('app.record.create.show', (event) => {
    const record = event.record;

    // まず、フィールドを編集できないように非活性化する
    record[UNIT_PRICE_ID_FIELD].disabled = true;

    // APIで、このアプリの最大の単価IDを取得する
    const query = `order by ${UNIT_PRICE_ID_FIELD} desc limit 1`;

    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: APP_ID,
      query: query,
      fields: [UNIT_PRICE_ID_FIELD]
    }).then(resp => {
      let nextId = 1; // レコードが1件もなければ、IDは1から始まる

      // レコードが見つかった場合
      if (resp.records.length > 0) {
        const latestId = Number(resp.records[0][UNIT_PRICE_ID_FIELD].value);
        // 取得したIDが有効な数値の場合、+1する
        if (!isNaN(latestId)) {
          nextId = latestId + 1;
        }
      }

      // 非同期処理の完了後に、kintone.app.record.set() を使って値を画面に反映させる
      const currentRecordToSet = kintone.app.record.get();
      currentRecordToSet.record[UNIT_PRICE_ID_FIELD].value = nextId;
      kintone.app.record.set(currentRecordToSet);

    }).catch(err => {
      console.error('単価IDの取得エラー:', err);
      // エラーが発生した場合は、フィールドにエラーメッセージを表示する
      const currentRecordToSet = kintone.app.record.get();
      currentRecordToSet.record[UNIT_PRICE_ID_FIELD].error = 'IDの自動取得に失敗しました。';
      kintone.app.record.set(currentRecordToSet);
    });

    return event;
  });

})();
