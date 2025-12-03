(function() {
    'use strict';

    // 設定値
    const CONFIG = {
        PRODUCT_APP_ID: 31,           // 取り置き商品アプリID
        SPACE_ELEMENT_ID: 'sugggest', // スペースフィールドの要素ID
        TABLE_CODE: 'テーブル',        // サブテーブルのフィールドコード
        
        // 絞り込みに使用するフィールドコード
        FILTER: {
            reserveType: '取り置き種別',             // 取り置きアプリ側
            productPeriod: 'ドロップダウン_期間名称', // 商品アプリ側
            pickupCheck: 'チェックボックス_ピックアップ表示', // 商品アプリ側
            pickupValue: '表示する'                   // ピックアップのチェック値
        },

        // フィールドマッピング設定
        MAPPING: {
            itemName:   { target: 'ルックアップ_商品名',    source: '文字列__1行_商品名' },
            price:      { target: '数値_1_単価',         source: '数値_単価' },
            amount:     { target: '数値_1_単位量',       source: '数値_単位量' },
            unitSym:    { target: '文字列__1行__単位記号', source: 'ドロップダウン_単位記号' },
            quantity:   { target: '数値',                defaultValue: '' },  // 数量は空
            remark:     { target: '文字列__1行__0',       defaultValue: '' },  
            calc:       { target: '計算' }                
        }
    };

    // イベント
    const events = [
        'app.record.create.show',
        'app.record.edit.show',
        'app.record.create.change.' + CONFIG.FILTER.reserveType,
        'app.record.edit.change.' + CONFIG.FILTER.reserveType
    ];

    kintone.events.on(events, function(event) {
        const record = event.record;
        // 現在の「取り置き種別」の値を取得
        const currentPeriodType = record[CONFIG.FILTER.reserveType].value;

        // 商品一覧を更新
        updateProductList(currentPeriodType);

        return event;
    });

    /**
     * 商品一覧を取得してボタンを表示する関数
     */
    function updateProductList(periodType) {
        // スペース要素を取得
        const spaceElement = kintone.app.record.getSpaceElement(CONFIG.SPACE_ELEMENT_ID);
        if (!spaceElement) return;

        // コンテナの取得または作成
        let container = document.getElementById('product-list-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'product-list-container';
            container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; padding: 10px; border: 1px solid #e3e7e8; background-color: #f5f5f5; border-radius: 4px; margin-bottom: 20px;';
            spaceElement.appendChild(container);
        } else {
            container.innerHTML = ''; // クリア
        }

        // ラベル再生成
        const label = document.createElement('div');
        label.innerText = '▼ 商品をクリックして追加';
        label.style.width = '100%';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '14px';
        label.style.marginBottom = '5px';
        label.style.color = '#333';
        container.appendChild(label);

        // 取り置き種別が未選択の場合
        if (!periodType) {
            const msg = document.createElement('div');
            msg.innerText = '※取り置き種別を選択してください';
            msg.style.color = '#666';
            container.appendChild(msg);
            return;
        }

        // クエリ作成
        const query = `${CONFIG.FILTER.productPeriod} in ("${periodType}") and ${CONFIG.FILTER.pickupCheck} in ("${CONFIG.FILTER.pickupValue}") order by 作成日時 desc limit 500`;

        const body = {
            app: CONFIG.PRODUCT_APP_ID,
            query: query
        };

        // API実行
        kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body, function(resp) {
            const products = resp.records;

            if (products.length === 0) {
                const msg = document.createElement('div');
                msg.innerText = '対象の商品がありません。';
                msg.style.color = '#666';
                container.appendChild(msg);
                return;
            }

            products.forEach(function(product) {
                const btn = document.createElement('button');
                const productName = product[CONFIG.MAPPING.itemName.source].value;
                const price = product[CONFIG.MAPPING.price.source].value;
                const unit = product[CONFIG.MAPPING.unitSym.source].value;
                
                btn.innerText = `${productName} (${parseInt(price).toLocaleString()}円/${unit})`;
                
                // ★修正箇所：font-sizeを16pxに変更しました
                btn.style.cssText = 'padding: 8px 16px; border: 1px solid #3498db; background-color: #fff; color: #3498db; border-radius: 20px; cursor: pointer; transition: all 0.2s; font-size: 16px;';
                
                btn.onmouseover = function() { this.style.backgroundColor = '#3498db'; this.style.color = '#fff'; };
                btn.onmouseout  = function() { this.style.backgroundColor = '#fff'; this.style.color = '#3498db'; };

                btn.onclick = function(e) {
                    e.preventDefault(); 
                    addProductToTable(product);
                };

                container.appendChild(btn);
            });
        }, function(error) {
            console.error(error);
            const msg = document.createElement('div');
            msg.innerText = '商品情報の取得に失敗しました。';
            container.appendChild(msg);
        });
    }

    // サブテーブルに行を追加する関数
    function addProductToTable(productRecord) {
        const recordData = kintone.app.record.get();
        let table = recordData.record[CONFIG.TABLE_CODE].value;

        // 空行（商品名が入っていない行）を削除する処理
        table = table.filter(function(row) {
            const itemName = row.value[CONFIG.MAPPING.itemName.target].value;
            return itemName !== undefined && itemName !== null && itemName !== "";
        });
        
        recordData.record[CONFIG.TABLE_CODE].value = table;

        // 新しい行のオブジェクトを作成
        const newRow = {
            value: {
                [CONFIG.MAPPING.itemName.target]: {
                    type: 'SINGLE_LINE_TEXT',
                    value: productRecord[CONFIG.MAPPING.itemName.source].value,
                    lookup: true 
                },
                [CONFIG.MAPPING.price.target]: {
                    type: 'NUMBER',
                    value: productRecord[CONFIG.MAPPING.price.source].value
                },
                [CONFIG.MAPPING.amount.target]: {
                    type: 'NUMBER',
                    value: productRecord[CONFIG.MAPPING.amount.source].value
                },
                [CONFIG.MAPPING.unitSym.target]: {
                    type: 'SINGLE_LINE_TEXT',
                    value: productRecord[CONFIG.MAPPING.unitSym.source].value
                },
                [CONFIG.MAPPING.quantity.target]: {
                    type: 'NUMBER',
                    value: CONFIG.MAPPING.quantity.defaultValue
                },
                [CONFIG.MAPPING.remark.target]: {
                    type: 'SINGLE_LINE_TEXT',
                    value: CONFIG.MAPPING.remark.defaultValue
                },
                [CONFIG.MAPPING.calc.target]: {
                    type: 'CALC',
                    value: '' 
                }
            }
        };

        table.push(newRow);
        kintone.app.record.set(recordData);
    }

})();