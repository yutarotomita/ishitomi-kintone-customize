(function() {
  'use strict';

  // --- 設定項目 ---
  const APP_ID = 5; // このアプリ自身のID
  const CUSTOMER_FIELD = 'ルックアップ_取引名'; // 取引先名フィールド
  const INVOICE_NUMBER_FIELD = '数値_納品書番号'; // 納品書番号フィールド
  const TRIGGER_FIELD = '数値_シール発行有無'; // ルックアップによって値がコピーされる、監視対象のフィールド

  /**
   * 次の納品書番号を取得・設定する関数
   */
  const setNextInvoiceNumber = () => {
    // ★★★ 修正点1：関数内で現在のレコード情報を取得するように変更 ★★★
    const record = kintone.app.record.get().record;
    const customerName = record[CUSTOMER_FIELD].value;

    // 取引先が選択されていなければ納品書番号をクリアする
    if (!customerName) {
      const currentRecordToSet = kintone.app.record.get();
      currentRecordToSet.record[INVOICE_NUMBER_FIELD].value = '';
      kintone.app.record.set(currentRecordToSet);
      return;
    }

    // APIで、この取引先の最大の納品書番号を取得する
    const query = `${CUSTOMER_FIELD} = "${customerName}" order by ${INVOICE_NUMBER_FIELD} desc limit 1`;

    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: APP_ID,
      query: query,
      fields: [INVOICE_NUMBER_FIELD]
    }).then(resp => {
      let nextNumber = 1; // デフォルトの初期値
      
      if (resp.records.length > 0) {
        const latestNumber = Number(resp.records[0][INVOICE_NUMBER_FIELD].value);
        if (!isNaN(latestNumber)) {
          nextNumber = latestNumber + 1;
        }
      }

      // ★★★ 修正点2：非同期処理の完了後に kintone.app.record.set() を使って値をセットする ★★★
      const currentRecordToSet = kintone.app.record.get();
      currentRecordToSet.record[INVOICE_NUMBER_FIELD].value = nextNumber;
      kintone.app.record.set(currentRecordToSet);

    }).catch(err => {
      console.error('納品書番号の取得エラー:', err);
    });
  };

  // --- kintone イベントハンドラ ---
  const events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.' + TRIGGER_FIELD,
    'app.record.edit.change.' + TRIGGER_FIELD
  ];

  kintone.events.on(events, (event) => {
    const record = event.record;

    // ★★★ 修正点3：フィールドの非活性化は、イベント内で同期的に行う ★★★
    record[INVOICE_NUMBER_FIELD].disabled = true;
    
    // 値のセットは非同期で行う関数を呼び出す
    if (event.type.endsWith('.show')) {
      if (record[CUSTOMER_FIELD].value) {
        setNextInvoiceNumber();
      }
    } else {
      // トリガーフィールド変更時(.change)の処理
      setNextInvoiceNumber();
    }
    
    return event;
  });

})();
