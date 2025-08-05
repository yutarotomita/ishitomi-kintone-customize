(function() {
  'use strict';

  // --- 設定項目 ---
  const HISTORY_APP_ID = 5;
  const CUSTOMER_FIELD = 'ルックアップ_取引名';
  const SUBTABLE_CODE = 'テーブル';

  /**
   * サブテーブル内の「取得」ボタンの動作を上書きする関数
   */
  const overrideSubtableLookupButtons = () => {
    // サブテーブル内の全てのルックアップ「取得」ボタンを取得
    const lookupButtons = document.querySelectorAll('.subtable-row-gaia .lookup-field-lookup-button-gaia');

    lookupButtons.forEach(btn => {
      // 既に上書き済みのボタンは何もしない（data属性で管理）
      if (btn.dataset.customized) return;

      // 「商品番号」ルックアップのボタンに絞り込む
      // ボタンの親要素を辿り、フィールドコードを含むクラスがあるかチェック
      const fieldContainer = btn.closest('[class*="field-ルックアップ_商品番号"]');
      if (!fieldContainer) return;

      // クリックイベントを上書き
      btn.addEventListener('click', (e) => {
        // kintone標準の動作を停止
        e.preventDefault();
        e.stopPropagation();

        // 独自のダイアログを開く
        openHistoryDialog();
      }, true); // イベントのキャプチャ段階で処理するためtrueを指定

      // 上書き済みマークを付ける
      btn.dataset.customized = 'true';
    });
  };

  /**
   * ダイアログを開くメインの関数
   */
  const openHistoryDialog = () => {
    const currentRecord = kintone.app.record.get().record;
    const recordId = kintone.app.record.getId();
    const customerName = currentRecord[CUSTOMER_FIELD].value;

    if (!customerName) {
      alert('先に取引先名を選択してください。');
      return;
    }

    const query = `${CUSTOMER_FIELD} = "${customerName}" and レコード番号 != ${recordId || 0} order by 作成日時 desc limit 50`;

    kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: HISTORY_APP_ID,
      query: query,
    }).then(resp => {
      const uniqueProductHistory = processHistoryData(resp.records);
      buildAndShowDialog(uniqueProductHistory);
    }).catch(err => {
      console.error(err);
      alert('履歴の取得中にエラーが発生しました。');
    });
  };
  
  // processHistoryData, buildAndShowDialog, addItemToSubtable の各関数は変更ありません
  // （以下、前回の回答と同じコード）
  /**
   * APIで取得したレコードから、重複を除いた最新の商品リストを作成する
   * @param {Array} records APIから取得したレコード配列
   * @returns {Array} 重複排除・整形済みの商品リスト
   */
  const processHistoryData = (records) => {
    const productMap = new Map();

    // 全てのレコードのサブテーブルを走査
    records.forEach(record => {
      const orderDate = new Date(record.作成日時.value).toLocaleDateString();
      if (!record[SUBTABLE_CODE] || !record[SUBTABLE_CODE].value) return;

      record[SUBTABLE_CODE].value.forEach(subtableRow => {
        const item = subtableRow.value;
        const productCode = item.ルックアップ_商品番号.value;

        // まだマップにない商品コードの場合のみ追加（これで最新履歴が残る）
        if (!productMap.has(productCode)) {
          productMap.set(productCode, {
            orderDate: orderDate,
            productCode: productCode,
            productName: item.文字列__1行_商品名.value,
            unit: item.文字列__1行__単位.value,
            price: item.数値_単価.value,
            description: item.文字列__1行_摘要.value
          });
        }
      });
    });

    return Array.from(productMap.values());
  };

  /**
   * 履歴データからダイアログを組み立てて表示する
   * @param {Array} historyData 表示する履歴データの配列
   */
  const buildAndShowDialog = (historyData) => {
    // 既存のダイアログがあれば削除
    const existingDialog = document.querySelector('.custom-lookup-overlay');
    if (existingDialog) existingDialog.remove();

    // HTMLを生成
    let tableRowsHtml = '';
    historyData.forEach(item => {
      tableRowsHtml += `
        <tr>
          <td>
            <button class="select-history-item-btn" 
              data-product-code="${item.productCode}"
              data-product-name="${item.productName}"
              data-unit="${item.unit}"
              data-price="${item.price}"
              data-description="${item.description}"
            >選択</button>
          </td>
          <td>${item.orderDate}</td>
          <td>${item.productName}</td>
          <td>${Number(item.price).toLocaleString()} 円</td>
        </tr>
      `;
    });

    const dialogHtml = `
      <div class="custom-lookup-dialog">
        <div class="custom-lookup-header">
          <span>受注履歴から商品を選択</span>
          <button class="custom-lookup-close">&times;</button>
        </div>
        <div class="custom-lookup-body">
          <table class="custom-lookup-table">
            <thead>
              <tr>
                <th>選択</th>
                <th>最終受注日</th>
                <th>商品名</th>
                <th>単価</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // ダイアログをページに追加
    const overlay = document.createElement('div');
    overlay.className = 'custom-lookup-overlay';
    overlay.innerHTML = dialogHtml;
    document.body.appendChild(overlay);

    // 閉じるボタンのイベント
    overlay.querySelector('.custom-lookup-close').onclick = () => overlay.remove();
    // 背景クリックで閉じる
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    };

    // 選択ボタンのイベント
    overlay.querySelectorAll('.select-history-item-btn').forEach(btn => {
      btn.onclick = (e) => {
        addItemToSubtable(e.target.dataset);
        overlay.remove(); // 選択したらダイアログを閉じる
      };
    });
  };

  /**
   * 選択した商品をサブテーブルに追加する
   * @param {Object} itemData data属性から取得した商品データ
   */
  const addItemToSubtable = (itemData) => {
    const currentRecord = kintone.app.record.get();
    const subtable = currentRecord.record[SUBTABLE_CODE].value;

    const newRow = {
      value: {
        'ルックアップ_商品番号': { value: itemData.productCode },
        '文字列__1行_商品名': { value: itemData.productName },
        '文字列__1行__単位': { value: itemData.unit },
        '数値_単価': { value: itemData.price },
        '文字列__1行_摘要': { value: itemData.description },
        '数値_数量': { value: 1 }, // 数量はデフォルトで1を設定
      }
    };

    subtable.push(newRow);
    kintone.app.record.set(currentRecord);
  };
  
// --- kintone イベントハンドラ ---
  const events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.' + SUBTABLE_CODE, // サブテーブルの行追加・削除時
    'app.record.edit.change.' + SUBTABLE_CODE
  ];

  kintone.events.on(events, (event) => {
    // setTimeoutを使い、kintoneがDOMを構築し終わるのを少し待つ
    setTimeout(overrideSubtableLookupButtons, 100);
    return event;
  });

})();