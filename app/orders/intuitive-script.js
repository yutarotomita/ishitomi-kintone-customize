(function() {
  'use strict';

  // =================================================================
  // --- 設定項目 ---
  // =================================================================

  const HISTORY_APP_ID = 5; // 履歴を検索するアプリ（受注アプリ自身）のID
  const CUSTOMER_FIELD = 'ルックアップ_取引名'; // 取引先名フィールドのコード
  const SUBTABLE_CODE = 'テーブル'; // 追加対象のサブテーブルのコード
  const DISPLAY_SPACE_ID = 'history_display_space'; // 履歴表示用のスペースの要素ID

  // =================================================================
  // --- 関数定義 ---
  // =================================================================

  /**
   * 履歴を取得してスペースに表示するメインの関数
   */
  const showHistoryList = (record) => {
    const customerName = record[CUSTOMER_FIELD].value;
    const displaySpaceEl = kintone.app.record.getSpaceElement(DISPLAY_SPACE_ID);

    if (!displaySpaceEl) {
      return; 
    }

    if (!customerName) {
      displaySpaceEl.innerHTML = '';
      return;
    }
    
    displaySpaceEl.innerHTML = '履歴を検索中...';

    const query = `${CUSTOMER_FIELD} = "${customerName}" order by 作成日時 desc limit 50`;

    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: HISTORY_APP_ID,
      query: query,
    }).then(resp => {
      const uniqueProductHistory = processHistoryData(resp.records);
      renderHistoryList(uniqueProductHistory, displaySpaceEl);
    }).catch(err => {
      console.error(err);
      displaySpaceEl.innerHTML = '<span style="color:red;">履歴の取得中にエラーが発生しました。</span>';
    });
  };

  /**
   * APIで取得したレコードから、重複を除いた最新の商品リストを作成する
   */
  const processHistoryData = (records) => {
    const productMap = new Map();
    records.forEach(record => {
      if (!record[SUBTABLE_CODE] || !record[SUBTABLE_CODE].value) return;
      record[SUBTABLE_CODE].value.forEach(subtableRow => {
        const item = subtableRow.value;
        const productCode = item.ルックアップ_商品番号.value;
        if (productCode && !productMap.has(productCode)) {
          productMap.set(productCode, {
            productCode: productCode,
            productName: item.文字列__1行_商品名.value,
          });
        }
      });
    });
    return Array.from(productMap.values());
  };
  
  /**
   * 履歴リストをHTMLとして組み立て、スペースに表示する
   */
  const renderHistoryList = (historyData, spaceElement) => {
    if (historyData.length === 0) {
      spaceElement.innerHTML = '<span>この取引先の受注履歴はありません。</span>';
      return;
    }
    
    let listHtml = '<div style="border: 1px solid #e3e3e3; padding: 10px; margin-top: 10px; max-height: 200px; overflow-y: auto;">';
    listHtml += '<strong>クリックして商品を追加:</strong><ul style="margin-top: 5px; padding-left: 20px;">';

    historyData.forEach(item => {
      listHtml += `
        <li style="margin-bottom: 5px;">
          <a href="#" class="history-item-selector" data-product-code="${item.productCode}">
            ${item.productName} (商品番号: ${item.productCode})
          </a>
        </li>
      `;
    });

    listHtml += '</ul></div>';
    spaceElement.innerHTML = listHtml;

    spaceElement.querySelectorAll('.history-item-selector').forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        addItemToSubtable(e.target.dataset.productCode);
      };
    });
  };

  /**
   * 選択した商品をサブテーブルに新しい行として追加し、ルックアップを自動実行させる
   */
  const addItemToSubtable = (productCode) => {
    const currentRecord = kintone.app.record.get();
    const subtable = currentRecord.record[SUBTABLE_CODE].value;

    const newRow = {
      value: {
        'ルックアップ_商品番号': { type: 'NUMBER', value: productCode, lookup: true },
        '数値_数量':         { type: 'NUMBER',           value: null },
        '文字列__1行_商品名':   { type: 'SINGLE_LINE_TEXT', value: '' },
        '数値_単価':         { type: 'NUMBER',           value: null },
        '文字列__1行__単位':   { type: 'SINGLE_LINE_TEXT', value: '' },
        '金額':            { type: 'CALC',             value: null },
        '文字列__1行_摘要':   { type: 'SINGLE_LINE_TEXT', value: '' },
        'ルックアップ_単価ID': { type: 'NUMBER',           value: null },
        '文字列__1行__0':      { type: 'SINGLE_LINE_TEXT', value: '' }
      }
    };

    subtable.push(newRow);
    kintone.app.record.set(currentRecord);
  };

  // =================================================================
  // --- kintone イベントハンドラ ---
  // =================================================================
  const events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.' + CUSTOMER_FIELD,
    'app.record.edit.change.' + CUSTOMER_FIELD
  ];

  kintone.events.on(events, (event) => {
    showHistoryList(event.record);
    return event;
  });

})();