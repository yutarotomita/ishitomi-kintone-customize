(function() {
  'use strict';

  // --- 設定項目 ---
  const APP_ID = 7; // この単価マスタアプリ自身のID
  const CUSTOMER_FIELD = 'ルックアップ_取引先名'; // 取引先名フィールド
  const PRODUCT_FIELD = 'ルックアップ_商品名'; // 商品名フィールド
  const DEFAULT_FLAG_FIELD = 'ドロップダウン_初期値フラグ'; // 初期値フラグのドロップダウン

  // --- kintone イベントハンドラ ---

  // ---【機能】レコード保存時の初期値フラグ制御 ---
  const submitEvents = ['app.record.create.submit', 'app.record.edit.submit'];
  kintone.events.on(submitEvents, (event) => {
    const record = event.record;
    const customerName = record[CUSTOMER_FIELD].value;
    const productName = record[PRODUCT_FIELD].value;
    const isSetToTrue = record[DEFAULT_FLAG_FIELD].value === 'TRUE';
    const recordId = kintone.app.record.getId(); // 編集画面でのみ値が入る

    // 取引先名または商品名が未入力の場合は何もしない
    if (!customerName || !productName) {
      return event;
    }

    // 同じ取引先・商品の組み合わせを持つ他のレコードを検索
    let query = `${CUSTOMER_FIELD} = "${customerName}" and ${PRODUCT_FIELD} = "${productName}"`;
    if (recordId) {
      query += ` and レコード番号 != ${recordId}`;
    }

    // APIの応答を待つためにPromiseを返す
    return kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: APP_ID,
      query: query,
      fields: ['$id', DEFAULT_FLAG_FIELD]
    }).then(resp => {
      const otherDefaults = resp.records.filter(r => r[DEFAULT_FLAG_FIELD].value === 'TRUE');

      // ケース1: 他にレコードが存在しない、または他のレコードに初期値フラグがない場合
      // このレコードを強制的に初期値にする
      if (resp.records.length === 0 || otherDefaults.length === 0) {
        record[DEFAULT_FLAG_FIELD].value = 'TRUE';
        return event;
      }

      // ケース2: 他に初期値が存在し、かつこのレコードも初期値にしようとしている場合
      if (otherDefaults.length > 0 && isSetToTrue) {
        const confirmed = confirm('他のレコードに初期値フラグが設定されています。この単価を新しい初期値にしてよろしいでしょうか？（以前の初期値は解除されます）');
        return confirmed ? event : false; // OKなら保存、キャンセルなら保存中止
      }

      // ケース3: 他に初期値が存在するが、このレコードは初期値にしない場合
      // 何もせず保存を許可
      return event;

    }).catch(err => {
      console.error('既存レコードの確認エラー:', err);
      event.error = '既存レコードの確認中にエラーが発生しました。';
      return event;
    });
  });

  // ---【機能-続き】保存成功後、古い初期値フラグを解除する処理 ---
  const successEvents = ['app.record.create.submit.success', 'app.record.edit.submit.success'];
  kintone.events.on(successEvents, (event) => {
    const record = event.record;
    const customerName = record[CUSTOMER_FIELD].value;
    const productName = record[PRODUCT_FIELD].value;
    const isDefault = record[DEFAULT_FLAG_FIELD].value === 'TRUE';
    const savedRecordId = event.recordId;

    // 保存したレコードが初期値でない、または必須項目が空欄なら何もしない
    if (!isDefault || !customerName || !productName) {
      return event;
    }

    // ★★★ 修正点：ドロップダウンのクエリを "=" から "in" に変更 ★★★
    const query = `${CUSTOMER_FIELD} = "${customerName}" and ${PRODUCT_FIELD} = "${productName}" and ${DEFAULT_FLAG_FIELD} in ("TRUE") and レコード番号 != ${savedRecordId}`;

    return kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
      app: APP_ID,
      query: query,
      fields: ['$id']
    }).then(resp => {
      if (resp.records.length === 0) {
        return event; // 更新対象がなければ終了
      }

      // 見つかった他の初期値レコードを「FALSE」に更新する
      const updates = resp.records.map(r => ({
        id: r.$id.value,
        record: {
          [DEFAULT_FLAG_FIELD]: { value: 'FALSE' }
        }
      }));

      return kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', {
        app: APP_ID,
        records: updates
      });
    }).then(updateResp => {
      console.log('古い初期値フラグが更新されました。');
      return event;
    }).catch(err => {
      console.error('古い初期値フラグの更新に失敗しました:', err);
      alert('レコードは保存されましたが、古い初期値フラグの更新に失敗しました。手動で修正してください。');
      return event;
    });
  });

})();
