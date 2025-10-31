/**
 * RSFormat.js - 零依賴的資料庫結果集格式化庫（完整版）
 * 版本: 2.3.0
 * 作者: Claude Code / Gemini
 * 描述: 將資料庫查詢結果格式化為多種顯示格式，並包含完整的 UI 控制器、排序與篩選功能
 *       只需一行程式碼即可創建完整的結果展示介面
 */

(function(global) {
    'use strict';

    // ==================== 工具函數 ====================

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function convertNewlineToBr(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        const escaped = escapeHtml(str);
        return escaped.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>').replace(/\r/g, '<br>');
    }

    function extractColumns(data) {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0]);
    }

    function addIdColumn(data) {
        return data.map((row, index) => ({
            ID: index + 1,
            ...row
        }));
    }

    function transposeData(columns, data) {
        if (!columns || columns.length === 0 || !data || data.length === 0) {
            return { headers: [], bodyData: [] };
        }

        const firstColumnName = columns[0];
        const newHeaders = [firstColumnName, ...data.map(row => row[firstColumnName] ?? '')];
        const newBodyData = columns.slice(1).map(colName => {
            return [colName, ...data.map(row => row[colName] ?? '')];
        });

        return { headers: newHeaders, bodyData: newBodyData };
    }

    // ==================== 樣式注入 ====================

    function injectStyles() {
        const styleId = 'rsformat-inline-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* RSFormat.js 內聯樣式 */
            .rsformat-wrapper {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                margin: 1rem 0;
            }

            .rsformat-controls {
                display: flex;
                gap: 10px;
                align-items: center;
                margin-bottom: 10px;
                flex-wrap: wrap;
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 4px;
            }

            .rsformat-btn {
                padding: 6px 12px;
                font-size: 13px;
                background-color: #ffffff;
                border: 1px solid #ddd;
                border-radius: 4px;
                color: #333;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
            }

            .rsformat-btn:hover:not(:disabled) {
                background-color: #e9ecef;
                border-color: #adb5bd;
            }

            .rsformat-btn.active {
                background-color: #007bff;
                color: white;
                border-color: #007bff;
            }

            .rsformat-btn.active:hover:not(:disabled) {
                background-color: #0056b3;
                border-color: #0056b3;
            }

            .rsformat-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .rsformat-btn-success {
                background-color: #28a745;
                color: white;
                border-color: #28a745;
            }

            .rsformat-btn-success:hover:not(:disabled) {
                background-color: #218838;
                border-color: #1e7e34;
            }

            .rsformat-checkbox-group {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .rsformat-checkbox {
                width: auto;
                margin: 0;
                cursor: pointer;
            }

            .rsformat-label {
                margin: 0;
                font-size: 13px;
                cursor: pointer;
                user-select: none;
            }

            .rsformat-number-input {
                width: 60px;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 13px;
            }

            .rsformat-divider {
                width: 1px;
                height: 20px;
                background-color: #dee2e6;
                margin: 0 5px;
            }
            
            .rsformat-info-inline {
                color: #6c757d;
                font-size: 13px;
                margin-left: 10px;
            }

            .rsformat-search-wrapper {
                margin-left: auto;
            }

            .rsformat-search-input {
                padding: 6px 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 13px;
                width: 200px;
            }

            .rsformat-container {
                margin-top: 0.5rem;
            }

            .rsformat-rowset {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 1rem;
                overflow-x: auto;
                white-space: pre;
                font-family: "Courier New", Courier, monospace;
                line-height: 1.5;
            }

            .rsformat-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 0.5rem;
            }

            .rsformat-table th,
            .rsformat-table td {
                border: 1px solid #dee2e6;
                padding: 8px;
                text-align: left;
                vertical-align: top;
            }

            .rsformat-table thead th {
                background-color: #f8f9fa;
                font-weight: 600;
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .rsformat-table th.sortable {
                cursor: pointer;
                position: relative;
                padding-right: 25px;
            }

            .rsformat-table th.sortable:hover {
                background-color: #e9ecef;
            }

            .rsformat-table .sort-indicator {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 1.1em;
                line-height: 1;
                color: #6c757d;
            }

            .rsformat-table tbody tr:hover {
                background-color: #f1f3f5;
            }

            .rsformat-json {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 1rem;
                overflow-x: auto;
                font-family: "Courier New", Courier, monospace;
                line-height: 1.5;
                max-height: 500px;
                overflow-y: auto;
            }

            .rsformat-error {
                color: #dc3545;
                background-color: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                padding: 1rem;
                margin: 1rem 0;
            }
        `;

        document.head.appendChild(style);
    }

    // ==================== 渲染函數 ====================

    function renderRowSet(container, columns, data) {
        let text = `查詢成功，共回傳 ${data.length} 筆資料。\n\n`;

        const colWidths = columns.map(c => String(c).length);
        data.forEach(row => {
            columns.forEach((col, i) => {
                const val = String(row[col] ?? '');
                if (val.length > colWidths[i]) {
                    colWidths[i] = val.length;
                }
            });
        });

        text += columns.map((c, i) => String(c).padEnd(colWidths[i])).join(' | ') + '\n';
        text += columns.map((c, i) => '-'.repeat(colWidths[i])).join('-|-') + '\n';

        data.forEach(row => {
            text += columns.map((c, i) => String(row[c] ?? '').padEnd(colWidths[i])).join(' | ') + '\n';
        });

        container.innerHTML = `<div class="rsformat-container"><pre class="rsformat-rowset">${escapeHtml(text)}</pre></div>`;
    }

    function renderHtmlTable(container, columns, data, rowspanCount, useBr, formatter) {
        let tableHtml = '<div class="rsformat-container">';
        tableHtml += '<table class="rsformat-table"><thead><tr>';

        const sortState = formatter.sortState || {};

        columns.forEach(col => {
            const isSortable = formatter.options.format === 'table';
            const thClass = isSortable ? 'sortable' : '';
            const dataAttr = isSortable ? `data-column="${escapeHtml(col)}"` : '';
            
            let indicator = '';
            if (isSortable && col === sortState.column) {
                if (sortState.direction === 'asc') indicator = '<span class="sort-indicator">▲</span>';
                if (sortState.direction === 'desc') indicator = '<span class="sort-indicator">▼</span>';
            }

            tableHtml += `<th class="${thClass}" ${dataAttr}>${escapeHtml(col)}${indicator}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        if (data.length === 0) {
            tableHtml += `<tr><td colspan="${columns.length}" style="text-align: center;">沒有符合篩選條件的資料</td></tr>`;
        } else if (rowspanCount > 0 && data.length > 0) {
            const lastValues = new Array(rowspanCount).fill(null);

            for (let i = 0; i < data.length; i++) {
                tableHtml += '<tr>';

                for (let j = 0; j < columns.length; j++) {
                    const col = columns[j];
                    const isSpanCol = j < rowspanCount;
                    const cellValue = data[i][col];

                    if (isSpanCol && i > 0 && cellValue === lastValues[j]) {
                        continue;
                    }

                    if (isSpanCol) {
                        lastValues[j] = cellValue;
                    }

                    let span = 1;
                    if (isSpanCol) {
                        for (let k = i + 1; k < data.length; k++) {
                            if (data[k][col] === cellValue) {
                                span++;
                            } else {
                                break;
                            }
                        }
                    }

                    const displayValue = useBr ? convertNewlineToBr(cellValue) : escapeHtml(cellValue);
                    const rowspanAttr = span > 1 ? ` rowspan="${span}"` : '';
                    tableHtml += `<td${rowspanAttr}>${displayValue}</td>`;
                }

                tableHtml += '</tr>';
            }
        } else {
            data.forEach(row => {
                tableHtml += '<tr>';
                columns.forEach(col => {
                    const displayValue = useBr ? convertNewlineToBr(row[col]) : escapeHtml(row[col]);
                    tableHtml += `<td>${displayValue}</td>`;
                });
                tableHtml += '</tr>';
            });
        }

        tableHtml += '</tbody></table></div>';
        container.innerHTML = tableHtml;
    }

    function renderTransposedTable(container, headers, bodyData, useBr) {
        let tableHtml = '<div class="rsformat-container">';
        tableHtml += '<table class="rsformat-table"><thead><tr>';

        headers.forEach(header => {
            tableHtml += `<th>${escapeHtml(header)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        bodyData.forEach(rowDataArray => {
            tableHtml += '<tr>';
            rowDataArray.forEach(cellData => {
                const displayValue = useBr ? convertNewlineToBr(cellData) : escapeHtml(cellData);
                tableHtml += `<td>${displayValue}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table></div>';
        container.innerHTML = tableHtml;
    }

    function renderJson(container, data) {
        const jsonText = JSON.stringify(data, null, 2);
        container.innerHTML = `<div class="rsformat-container"><pre class="rsformat-json">${escapeHtml(jsonText)}</pre></div>`;
    }

    // ==================== RSFormatter 類 ====================

    class RSFormatter {
        constructor(selector, data, options) {
            this.selector = selector;
            this.originalData = data || [];
            this.originalColumns = options?.columns || extractColumns(this.originalData);

            this.options = {
                showControls: options?.showControls !== false,  // 預設顯示控制按鈕
                format: options?.format || 'table',
                showId: options?.showId || false,
                transpose: options?.transpose || false,
                rowspan: options?.rowspan ?? 3,
                newlineToBr: options?.newlineToBr !== false
            };

            this.sortState = { column: null, direction: 'none' }; // none, asc, desc
            this.filterText = '';

            this.container = null;
            this.controlsContainer = null;
            this.resultContainer = null;
            this.infoDisplay = null;
            this.searchInput = null;

            injectStyles();
            this.init();
        }

        init() {
            const element = document.querySelector(this.selector);
            if (!element) {
                console.error(`RSFormat: 找不到選擇器 "${this.selector}" 對應的元素`);
                return;
            }

            element.innerHTML = '';
            element.className = 'rsformat-wrapper';

            if (this.options.showControls) {
                this.createControls(element);
            }

            this.resultContainer = document.createElement('div');
            element.appendChild(this.resultContainer);

            this.render();
        }

        attachTableEventListeners() {
            if (this.options.format !== 'table' || this.options.transpose) return;

            const table = this.resultContainer.querySelector('.rsformat-table');
            if (!table) return;

            const header = table.querySelector('thead');
            if (!header) return;

            // 避免重複綁定
            if (header.dataset.listenerAttached === 'true') return;

            header.addEventListener('click', (e) => {
                const th = e.target.closest('th.sortable');
                if (th) {
                    const columnName = th.dataset.column;
                    this.sort(columnName);
                }
            });
            header.dataset.listenerAttached = 'true';
        }

        createControls(parentElement) {
            this.controlsContainer = document.createElement('div');
            this.controlsContainer.className = 'rsformat-controls';

            // 格式按鈕
            const formats = [
                { value: 'table', label: 'HTML Table' },
                { value: 'rowset', label: 'Row Set' },
                { value: 'json', label: 'JSON' }
            ];

            formats.forEach(fmt => {
                const btn = document.createElement('button');
                btn.className = 'rsformat-btn';
                btn.textContent = fmt.label;
                btn.dataset.format = fmt.value;
                if (fmt.value === this.options.format) {
                    btn.classList.add('active');
                }
                btn.onclick = () => this.setFormat(fmt.value);
                this.controlsContainer.appendChild(btn);
            });

            // 分隔線
            this.controlsContainer.appendChild(this.createDivider());

            // CSV 匯出按鈕
            const csvBtn = document.createElement('button');
            csvBtn.className = 'rsformat-btn rsformat-btn-success';
            csvBtn.textContent = '匯出 CSV';
            csvBtn.onclick = () => this.exportCsv();
            this.controlsContainer.appendChild(csvBtn);

            // 分隔線
            this.controlsContainer.appendChild(this.createDivider());

            // 顯示 ID 核取方塊
            const idCheckbox = this.createCheckbox('show-id', '顯示 ID', this.options.showId, (checked) => {
                this.options.showId = checked;
                this.render();
            });
            this.controlsContainer.appendChild(idCheckbox);

            // 轉置核取方塊
            const transposeCheckbox = this.createCheckbox('transpose', '轉置', this.options.transpose, (checked) => {
                this.options.transpose = checked;
                this.render();
            });
            this.controlsContainer.appendChild(transposeCheckbox);

            // Rowspan 輸入
            const rowspanGroup = document.createElement('div');
            rowspanGroup.className = 'rsformat-checkbox-group';

            const rowspanLabel = document.createElement('label');
            rowspanLabel.className = 'rsformat-label';
            rowspanLabel.textContent = 'Rowspan:';

            const rowspanInput = document.createElement('input');
            rowspanInput.type = 'number';
            rowspanInput.className = 'rsformat-number-input';
            rowspanInput.value = this.options.rowspan;
            rowspanInput.min = 0;
            rowspanInput.max = 10;
            rowspanInput.onchange = () => {
                this.options.rowspan = parseInt(rowspanInput.value) || 0;
                this.render();
            };

            rowspanGroup.appendChild(rowspanLabel);
            rowspanGroup.appendChild(rowspanInput);
            this.controlsContainer.appendChild(rowspanGroup);

            // 資料筆數資訊顯示
            this.infoDisplay = document.createElement('div');
            this.infoDisplay.className = 'rsformat-info-inline';
            this.controlsContainer.appendChild(this.infoDisplay);

            // 搜尋框
            const searchWrapper = document.createElement('div');
            searchWrapper.className = 'rsformat-search-wrapper';
            this.searchInput = document.createElement('input');
            this.searchInput.type = 'text';
            this.searchInput.placeholder = '搜尋...';
            this.searchInput.className = 'rsformat-search-input';
            this.searchInput.oninput = () => {
                this.filterText = this.searchInput.value.toLowerCase();
                this.render();
            };
            searchWrapper.appendChild(this.searchInput);
            this.controlsContainer.appendChild(searchWrapper);

            parentElement.appendChild(this.controlsContainer);
        }

        createDivider() {
            const divider = document.createElement('div');
            divider.className = 'rsformat-divider';
            return divider;
        }

        createCheckbox(id, label, checked, onChange) {
            const group = document.createElement('div');
            group.className = 'rsformat-checkbox-group';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'rsformat-checkbox';
            checkbox.id = 'rsformat-' + id;
            checkbox.checked = checked;
            checkbox.onchange = () => onChange(checkbox.checked);

            const labelElem = document.createElement('label');
            labelElem.className = 'rsformat-label';
            labelElem.htmlFor = 'rsformat-' + id;
            labelElem.textContent = label;

            group.appendChild(checkbox);
            group.appendChild(labelElem);

            return group;
        }

        setFormat(format) {
            this.options.format = format;

            if (this.controlsContainer) {
                this.controlsContainer.querySelectorAll('.rsformat-btn[data-format]').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.format === format);
                });
            }

            this.render();
        }

        sort(columnName) {
            const { column, direction } = this.sortState;
            let nextDirection;

            if (column !== columnName) {
                nextDirection = 'asc';
            } else {
                if (direction === 'asc') nextDirection = 'desc';
                else if (direction === 'desc') nextDirection = 'none';
                else nextDirection = 'asc';
            }
            
            this.sortState = { column: columnName, direction: nextDirection };
            this.render();
        }

        getProcessedData() {
            let columns = [...this.originalColumns];
            let data = [...this.originalData];

            // 1. 篩選
            if (this.filterText) {
                const filter = this.filterText;
                data = data.filter(row => {
                    return Object.values(row).some(value => 
                        String(value).toLowerCase().includes(filter)
                    );
                });
            }

            // 2. 增加 ID 欄位
            if (this.options.showId) {
                data = addIdColumn(data);
                columns = ['ID', ...columns];
            }

            // 3. 排序
            const { column, direction } = this.sortState;
            if (this.options.format === 'table' && direction !== 'none' && column) {
                data.sort((a, b) => {
                    const valA = a[column];
                    const valB = b[column];

                    if (valA === valB) return 0;
                    if (valA === null || valA === undefined) return 1;
                    if (valB === null || valB === undefined) return -1;

                    if (typeof valA === 'number' && typeof valB === 'number') {
                        return direction === 'asc' ? valA - valB : valB - valA;
                    }

                    const strA = String(valA).toLowerCase();
                    const strB = String(valB).toLowerCase();

                    if (strA < strB) return direction === 'asc' ? -1 : 1;
                    if (strA > strB) return direction === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            return { processedData: data, columns };
        }

        render() {
            const { processedData, columns } = this.getProcessedData();

            if (this.infoDisplay) {
                const total = this.originalData.length;
                const shown = processedData.length;
                if (total === shown) {
                    this.infoDisplay.textContent = `共 ${total} 筆資料`;
                } else {
                    this.infoDisplay.textContent = `共 ${total} 筆資料，顯示 ${shown} 筆`;
                }
            }

            if (!this.originalData || this.originalData.length === 0) {
                this.resultContainer.innerHTML = '<div class="rsformat-error">沒有資料可顯示</div>';
                return;
            }

            if (this.options.transpose) {
                // 轉置模式下，使用未篩選的完整資料，但仍套用ID選項
                let originalCols = [...this.originalColumns];
                let originalProcData = [...this.originalData];
                if (this.options.showId) {
                    originalProcData = addIdColumn(originalProcData);
                    originalCols = ['ID', ...originalCols];
                }
                const transposed = transposeData(originalCols, originalProcData);
                renderTransposedTable(this.resultContainer, transposed.headers, transposed.bodyData, this.options.newlineToBr);
            } else {
                switch (this.options.format) {
                    case 'rowset':
                        renderRowSet(this.resultContainer, columns, processedData);
                        break;
                    case 'table':
                        renderHtmlTable(this.resultContainer, columns, processedData, this.options.rowspan, this.options.newlineToBr, this);
                        break;
                    case 'json':
                        renderJson(this.resultContainer, processedData);
                        break;
                    default:
                        this.resultContainer.innerHTML = `<div class="rsformat-error">不支援的格式: ${this.options.format}</div>`;
                }
            }
            
            this.attachTableEventListeners();
        }

        exportCsv(filename) {
            filename = filename || 'export_' + new Date().toISOString().slice(0,10) + '.csv';

            const { processedData, columns } = this.getProcessedData();

            let csvContent = '';
            csvContent += columns.map(h => `"${String(h ?? '').replace(/"/g, '""')}"`).join(',') + '\r\n';

            processedData.forEach(row => {
                csvContent += columns.map(col => {
                    const value = String(row[col] ?? '').replace(/"/g, '""');
                    return `"${value}"`;
                }).join(',') + '\r\n';
            });

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        setData(data, columns) {
            this.originalData = data || [];
            this.originalColumns = columns || extractColumns(this.originalData);
            this.sortState = { column: null, direction: 'none' };
            this.filterText = '';
            if (this.searchInput) this.searchInput.value = '';
            this.render();
        }

        destroy() {
            const element = document.querySelector(this.selector);
            if (element) {
                element.innerHTML = '';
            }
        }
    }

    // ==================== 簡單函數式 API（保持向後相容）====================

    function render(selector, data, options) {
        options = options || {};
        options.showControls = false; // 簡單 API 不顯示控制按鈕

        return new RSFormatter(selector, data, options);
    }

    function exportCsv(data, filename, options) {
        options = options || {};
        filename = filename || 'export.csv';

        if (!data || !Array.isArray(data) || data.length === 0) {
            alert('沒有資料可匯出');
            return;
        }

        let columns = options.columns || extractColumns(data);
        let processedData = data;

        if (options.showId) {
            processedData = addIdColumn(processedData);
            columns = ['ID', ...columns];
        }

        let csvContent = '';
        csvContent += columns.map(h => `"${String(h ?? '').replace(/"/g, '""')}"`).join(',') + '\r\n';

        processedData.forEach(row => {
            csvContent += columns.map(col => {
                const value = String(row[col] ?? '').replace(/"/g, '""');
                return `"${value}"`;
            }).join(',') + '\r\n';
        });

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ==================== 匯出到全域 ====================

    const RSFormat = {
        // 類（推薦使用，包含完整 UI）
        create: function(selector, data, options) {
            return new RSFormatter(selector, data, options);
        },

        // 簡單函數式 API（向後相容）
        render: render,
        exportCsv: exportCsv,

        version: '2.3.0'
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RSFormat;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return RSFormat; });
    } else {
        global.RSFormat = RSFormat;
    }

})(this);
