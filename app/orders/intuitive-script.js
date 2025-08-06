(function() {
  'use strict';

  // --- 設定項目 ---
  const HISTORY_APP_ID = 5; // 履歴を検索するアプリ（受注アプリ自身）のID
  const CUSTOMER_FIELD = 'ルックアップ_取引名'; // 取引先名フィールドのコード
  const SUBTABLE_CODE = 'テーブル'; // 追加対象のサブテーブルのコード
  
  // スペースの要素ID
  const BUTTON_SPACE_ID = 'history_button_space';
  const DISPLAY_SPACE_ID = 'history_display_space';

  /**
   * 履歴表示ボタンを作成して配置する関数
   */
  const createHistoryButton = () => {
    const spaceEl = kintone.app.record.getSpaceElement(BUTTON_SPACE_ID);
    if (!spaceEl || spaceEl.querySelector('#show-history-btn')) return;

    const historyButton = document.createElement('button');
    historyButton.id = 'show-history-btn';
    historyButton.innerText = 'この取引先の受注履歴を表示';
    historyButton.className = 'kintoneplugin-button-normal';
    historyButton.onclick = showHistoryList;
    spaceEl.appendChild(historyButton);
  };

  /**
   * 履歴を取得してスペースに表示するメインの関数
   */
  const showHistoryList = () => {
    const currentRecord = kintone.app.record.get().record;
    const customerName = currentRecord[CUSTOMER_FIELD].value;

    if (!customerName) {
      alert('先に取引先名を選択してください。');
      return;
    }

    const displaySpaceEl = kintone.app.record.getSpaceElement(DISPLAY_SPACE_ID);
    if (!displaySpaceEl) {
      alert('履歴表示用のスペースが見つかりません。');
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

    // 作成した各リンクにクリックイベントを設定
    spaceElement.querySelectorAll('.history-item-selector').forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        addItemToSubtable(e.target.dataset.productCode);
      };
    });
  };

/**
   * 選択した商品をサブテーブルに新しい行として追加し、ルックアップを自動実行させる
   * ★★★ この関数をまるごと置き換えてください ★★★
   */
  const addItemToSubtable = (productCode) => {
    const currentRecord = kintone.app.record.get();
    const subtable = currentRecord.record[SUBTABLE_CODE].value;
    const newRowIndex = subtable.length; // これから追加する行のインデックス

    // まず、全てのフィールドが空の行データを作成
    const newRow = {
      value: {
        'ルックアップ_商品番号': { type: 'NUMBER', value: null },
        '数値_数量': { type: 'NUMBER', value: null },
        '文字列__1行_商品名': { type: 'SINGLE_LINE_TEXT', value: '' },
        '数値_単価': { type: 'NUMBER', value: null },
        '文字列__1行__単位': { type: 'SINGLE_LINE_TEXT', value: '' },
        '金額': { type: 'CALC', value: null },
        '文字列__1行_摘要': { type: 'SINGLE_LINE_TEXT', value: '' },
        'ルックアップ_単価ID': { type: 'NUMBER', value: null },
        '文字列__1行__0': { type: 'SINGLE_LINE_TEXT', value: '' }
      }
    };
    
    // 1. まず空の行を追加する
    subtable.push(newRow);
    kintone.app.record.set(currentRecord);

    // 2. 0.1秒待ってから、追加した行に値をセットし、再度レコードを更新する
    //    この「間」を設けることで、kintoneがルックアップの実行を認識しやすくなる
    setTimeout(() => {
      const updatedRecord = kintone.app.record.get();
      const targetRow = updatedRecord.record[SUBTABLE_CODE].value[newRowIndex];

      // 追加した行のルックアップフィールドに値をセット
      targetRow.value['ルックアップ_商品番号'].value = productCode;
      // ルックアップを実行するために、ルックアップフィールドのloolupプロパティをtrueに設定
      targetRow.value['ルックアップ_商品番号'].lookup = true;
      
      // 数量の初期値を1に設定
      targetRow.value['数値_数量'].value = '';

      // 再度レコードをセットする
      kintone.app.record.set(updatedRecord);
    }, 100);
  };

  // --- kintone イベントハンドラ ---
  const events = ['app.record.create.show', 'app.record.edit.show'];
  kintone.events.on(events, (event) => {
    createHistoryButton();
    return event;
  });

})();