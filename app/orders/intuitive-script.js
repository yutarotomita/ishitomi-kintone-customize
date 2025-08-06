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
   * 選択した商品をサブテーブルに新しい行として追加する
   */
  const addItemToSubtable = (productCode) => {
    const currentRecord = kintone.app.record.get();
    const subtable = currentRecord.record[SUBTABLE_CODE].value;

    // 新しい行のデータを作成（ルックアップフィールドに値を入れるだけ）
    const newRow = {
      value: {
        'ルックアップ_商品番号': {
          value: productCode // ここに値を入れると、kintoneが自動でルックアップを実行する
        },
        // 他のフィールドはルックアップの「ほかのフィールドのコピー」で自動設定される想定
      }
    };

    subtable.push(newRow);
    kintone.app.record.set(currentRecord);
  };

  // --- kintone イベントハンドラ ---
  const events = ['app.record.create.show', 'app.record.edit.show'];
  kintone.events.on(events, (event) => {
    createHistoryButton();
    return event;
  });

})();