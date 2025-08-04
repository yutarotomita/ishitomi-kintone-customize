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
  const processHistoryData=(records)=>{const t=new Map;return records.forEach(e=>{const o=new Date(e.作成日時.value).toLocaleDateString();e[SUBTABLE_CODE]&&e[SUBTABLE_CODE].value&&e[SUBTABLE_CODE].value.forEach(e=>{const r=e.value,c=r.ルックアップ_商品番号.value;t.has(c)||t.set(c,{orderDate:o,productCode:c,productName:r.文字列__1行_商品名.value,unit:r.文字列__1行__単位.value,price:r.数値_単価.value,description:r.文字列__1行_摘要.value})})}),Array.from(t.values())};
  const buildAndShowDialog=(historyData)=>{const t=document.querySelector(".custom-lookup-overlay");t&&t.remove();let e="";historyData.forEach(t=>{e+=`\n        <tr>\n          <td>\n            <button class="select-history-item-btn" \n              data-product-code="${t.productCode}"\n              data-product-name="${t.productName}"\n              data-unit="${t.unit}"\n              data-price="${t.price}"\n              data-description="${t.description}"\n            >選択</button>\n          </td>\n          <td>${t.orderDate}</td>\n          <td>${t.productName}</td>\n          <td>${Number(t.price).toLocaleString()} 円</td>\n        </tr>\n      `});const o=`\n      <div class="custom-lookup-dialog">\n        <div class="custom-lookup-header">\n          <span>受注履歴から商品を選択</span>\n          <button class="custom-lookup-close">&times;</button>\n        </div>\n        <div class="custom-lookup-body">\n          <table class="custom-lookup-table">\n            <thead>\n              <tr>\n                <th>選択</th>\n                <th>最終受注日</th>\n                <th>商品名</th>\n                <th>単価</th>\n              </tr>\n            </thead>\n            <tbody>\n              ${e}\n            </tbody>\n          </table>\n        </div>\n      </div>\n    `,r=document.createElement("div");r.className="custom-lookup-overlay",r.innerHTML=o,document.body.appendChild(r),r.querySelector(".custom-lookup-close").onclick=()=>r.remove(),r.onclick=t=>{t.target===r&&r.remove()},r.querySelectorAll(".select-history-item-btn").forEach(t=>{t.onclick=e=>{addItemToSubtable(e.target.dataset),r.remove()}})};
  const addItemToSubtable=(itemData)=>{const t=kintone.app.record.get(),e=t.record[SUBTABLE_CODE].value;e.push({value:{"ルックアップ_商品番号":{value:itemData.productCode},"文字列__1行_商品名":{value:itemData.productName},"文字列__1行__単位":{value:itemData.unit},"数値_単価":{value:itemData.price},"文字列__1行_摘要":{value:itemData.description},"数値_数量":{value:1}}}),kintone.app.record.set(t)};

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