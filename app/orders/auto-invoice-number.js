(function() {
  'use strict';

  // --- 設定項目 ---
  const APP_ID = 5; // このアプリ自身のID
  const CUSTOMER_FIELD = 'ルックアップ_取引名'; // 取引先名フィールド
  const INVOICE_NUMBER_FIELD = '数値_納品書番号'; // 納品書番号フィールド

  // ★★★ ルックアップによって値がコピーされる、監視対象のフィールド ★★★
  // (以前の履歴表示機能とトリガーを合わせるのが確実です)
  const TRIGGER_FIELD = '数値_シール発行有無'; 

  /**
   * 次の納品書番号を取得・設定する関数
   */
  const setNextInvoiceNumber = (record) => {
    const customerName = record[CUSTOMER_FIELD].value;

    // 取引先が選択されていなければ納品書番号をクリアする
    if (!customerName) {
      record[INVOICE_NUMBER_FIELD].value = '';
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
      
      // 履歴が見つかった場合
      if (resp.records.length > 0) {
        const latestNumber = Number(resp.records[0][INVOICE_NUMBER_FIELD].value);
        if (!isNaN(latestNumber)) {
          nextNumber = latestNumber + 1;
        }
      }

      // 取得した次の番号をフィールドにセット
      record[INVOICE_NUMBER_FIELD].value = nextNumber;

    }).catch(err => {
      console.error('納品書番号の取得エラー:', err);
      // エラーが発生しても、フィールドは非活性のまま何もしない
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

    // 画面表示時(.show)の処理
    if (event.type.endsWith('.show')) {
      // ★★★ 画面表示時に常にフィールドを非活性化 ★★★
      record[INVOICE_NUMBER_FIELD].disabled = true;
      
      // 既に取引先が選択されている場合は、次の番号を取得する
      if (record[CUSTOMER_FIELD].value) {
        setNextInvoiceNumber(record);
      }
    } else {
      // トリガーフィールド変更時(.change)の処理
      setNextInvoiceNumber(record);
    }
    
    return event;
  });

})();
