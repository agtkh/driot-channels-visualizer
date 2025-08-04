$(document).ready(function () {
    const $channelConfigsContainer = $('#channel-configs-container');
    const $errorMessageDiv = $('#error-message');
    const $gridToggle = $('#grid-toggle');
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);
    let channelConfigId = 0;
    let lastBlocksData = [];

    const setupCollapsibleSections = () => {
        $('[id^="toggle-"]').on('click', function(e) {
            if ($(e.target).closest('button, input').length) return;
            const $content = $(this).next();
            const $icon = $(this).find('svg');
            $content.slideToggle(200, () => {
                 $icon.css('transform', $content.is(':hidden') ? 'rotate(0deg)' : 'rotate(180deg)');
            });
        });
    };
    
    const createInputGroup = (label, value, defaultUnit) => `
        <div class="flex-1 min-w-[150px]">
            <label class="block text-xs font-medium text-gray-600 mb-1">${label}</label>
            <div class="flex rounded-md shadow-sm">
                <input type="number" value="${value}" class="config-input flex-1 block w-full min-w-0 rounded-none rounded-l-md border-gray-300 sm:text-sm">
                <select class="config-unit inline-flex items-center px-2 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    <option value="kHz" ${defaultUnit === 'kHz' ? 'selected' : ''}>kHz</option>
                    <option value="MHz" ${defaultUnit === 'MHz' ? 'selected' : ''}>MHz</option>
                    <option value="GHz" ${defaultUnit === 'GHz' ? 'selected' : ''}>GHz</option>
                </select>
            </div>
        </div>`;

    const updateMoveButtonsState = () => {
        const $rows = $channelConfigsContainer.find('.config-row');
        $rows.each(function(index) {
            $(this).find('.move-up-btn').prop('disabled', index === 0);
            $(this).find('.move-down-btn').prop('disabled', index === $rows.length - 1);
        });
    };

    const createChannelConfigRow = (data = {}) => {
        channelConfigId++;
        const { occupiedBw = {value: '', unit: 'kHz'}, channelWidth = {value: '', unit: 'kHz'}, channelSpacing = {value: '', unit: 'kHz'} } = data;
        const $div = $(`
            <div id="config-${channelConfigId}" class="config-row p-4 border rounded-md bg-gray-50 flex flex-wrap items-end gap-4">
                <div class="flex-1 flex flex-wrap gap-4">
                    ${createInputGroup('占有帯域幅', occupiedBw.value, occupiedBw.unit)}
                    ${createInputGroup('チャネル幅', channelWidth.value, channelWidth.unit)}
                    ${createInputGroup('チャネルSP', channelSpacing.value, channelSpacing.unit)}
                </div>
                <div class="flex items-center gap-2 pt-5">
                    <div class="flex flex-col gap-1">
                        <button class="move-up-btn px-2 py-1 bg-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed">▲</button>
                        <button class="move-down-btn px-2 py-1 bg-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed">▼</button>
                    </div>
                    <button class="remove-btn px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600 self-end">削除</button>
                </div>
            </div>
        `).appendTo($channelConfigsContainer);
        updateMoveButtonsState();
        return $div;
    };
    
    const addInitialConfigs = () => {
        const initialData = [
            { occupiedBw: {value: 6.25, unit: 'kHz'}, channelWidth: {value: 200, unit: 'kHz'}, channelSpacing: {value: 200, unit: 'kHz'} },
            { occupiedBw: {value: 12.5, unit: 'kHz'}, channelWidth: {value: 200, unit: 'kHz'}, channelSpacing: {value: 200, unit: 'kHz'} },
            { occupiedBw: {value: 25, unit: 'kHz'}, channelWidth: {value: 200, unit: 'kHz'}, channelSpacing: {value: 200, unit: 'kHz'} },
            { occupiedBw: {value: 50, unit: 'kHz'}, channelWidth: {value: 200, unit: 'kHz'}, channelSpacing: {value: 200, unit: 'kHz'} },
            { occupiedBw: {value: 100, unit: 'kHz'}, channelWidth: {value: 200, unit: 'kHz'}, channelSpacing: {value: 200, unit: 'kHz'} },
            { occupiedBw: {value: 200, unit: 'kHz'}, channelWidth: {value: 200, unit: 'kHz'}, channelSpacing: {value: 200, unit: 'kHz'} },
            { occupiedBw: {value: 400, unit: 'kHz'}, channelWidth: {value: 400, unit: 'kHz'}, channelSpacing: {value: 400, unit: 'kHz'} },
        ];
        initialData.forEach(createChannelConfigRow);
    };

    const showError = (message) => $errorMessageDiv.text(message).show();
    const hideError = () => $errorMessageDiv.hide();

    const convertToKHz = (value, unit) => {
        value = parseFloat(value);
        if (isNaN(value)) return NaN;
        switch (unit) {
            case 'MHz': return value * 1000;
            case 'GHz': return value * 1000 * 1000;
            default:    return value;
        }
    };

    const displayChannelSummary = (ranges, totalCount) => {
        const $container = $('#channel-summary-container');
        const $summaryBody = $('#channel-summary-body');
        $summaryBody.empty();
        if (ranges.length === 0) {
            $container.hide();
            return;
        }
        ranges.forEach(range => {
            const count = range.end - range.start + 1;
            $summaryBody.append(`<tr class="bg-white border-b"><td class="px-6 py-4">${range.occupiedBw.toLocaleString()} kHz</td><td class="px-6 py-4">Ch. ${range.start} - ${range.end}</td><td class="px-6 py-4">${count}</td></tr>`);
        });
        $('#total-channel-count').text(totalCount);
        $container.show();
    };

    const formatChannelNumbers = (numbers) => {
        if (!numbers || numbers.length === 0) return 'なし';
        numbers.sort((a, b) => a - b);
        const ranges = [];
        let start = numbers[0];
        for (let i = 1; i <= numbers.length; i++) {
            if (i === numbers.length || numbers[i] !== numbers[i-1] + 1) {
                let end = numbers[i-1];
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                if (i < numbers.length) start = numbers[i];
            }
        }
        return ranges.join(', ');
    };

    const displayBlockSummary = (blocks) => {
        lastBlocksData = blocks;
        const $container = $('#block-summary-container');
        const $summaryBody = $('#block-summary-body');
        $summaryBody.empty();
        if (!$gridToggle.is(':checked') || blocks.length === 0) {
            $container.hide();
            return;
        }
        blocks.forEach(block => {
            $summaryBody.append(`<tr class="bg-white border-b"><td class="px-6 py-4">ブロック ${block.blockNumber}</td><td class="px-6 py-4">${formatChannelNumbers(block.channels)}</td></tr>`);
        });
        $container.show();
    };

    const updateUrl = () => {
        const base64String = serializeSettings();
        const url = `${window.location.origin}${window.location.pathname}#${base64String}`;
        history.replaceState(null, '', url);
        $('#share-url').val(url);
    };

    const generateDriotConfig = (startFreq, endFreq, configs, channelRanges, blocks, totalChannelCount) => {
        const title = $('#visualization-title').val() || 'DrIotLowerBand';
        const instanceName = title.replace(/\s+/g, '');

        let output = `#Instance ${instanceName}\n#Component Channel\n`;
        channelRanges.forEach(range => {
            const config = configs.find(c => c.occupiedBw === range.occupiedBw);
            const count = range.end - range.start + 1;
            output += `# OBW=${range.occupiedBw}kHz, badnwidth=${config.channelWidth}kHz, spacing=${config.channelSpacing}kHz: ${count} (${range.start}-${range.end})\n`;
        });
        output += `# total: ${totalChannelCount}\n`;

        output += `[${instanceName}] is-driot-band = true\n`;
        output += `[${instanceName}] driot-band-start-freq-mhz = ${startFreq / 1000}\n`;
        output += `[${instanceName}] driot-band-end-freq-mhz = ${endFreq / 1000}\n`;
        output += `[${instanceName}] driot-channel-bandwidths-khz = ${configs.map(c => c.channelWidth).join(' ' )}\n`;
        output += `[${instanceName}] driot-channel-spaces-khz = ${configs.map(c => c.channelSpacing).join(' ' )}\n`;
        output += `[${instanceName}] driot-channel-interference-nominal-transmit-widths-khz = ${configs.map(c => c.occupiedBw).join(' ' )}\n`;
        output += `[${instanceName}] driot-channel-interference-receive-widths-khz = ${configs.map(c => c.occupiedBw).join(' ' )}\n`;
        
        if (blocks.length > 0) {
            output += `[${instanceName}] driot-block-count = ${blocks.length}\n`;
            blocks.forEach(block => {
                if (block.channels.length > 0) {
                    output += `[${instanceName}] driot-block-${block.blockNumber}-channels = ${block.channels.join(',')}\n`;
                }
            });
        }

        $('#driot-config-output').val(output);
    };

    const updateVisualization = () => {
        hideError();
        const startFreq = convertToKHz($('#start-freq').val(), $('#start-freq-unit').val());
        const endFreq = convertToKHz($('#end-freq').val(), $('#end-freq-unit').val());
        const gridSpacing = convertToKHz($('#grid-spacing').val(), $('#grid-spacing-unit').val());

        if (isNaN(startFreq) || isNaN(endFreq) || startFreq >= endFreq) {
            // Do not show error if inputs are empty, just don't draw
            if ($('#start-freq').val() && $('#end-freq').val()) {
                return showError('有効な周波数範囲を入力してください（開始 < 終了）。');
            }
            return;
        }

        const configs = [];
        let isValid = true;
        $channelConfigsContainer.find('.config-row').each(function() {
            const $row = $(this);
            const occupiedBw = convertToKHz($row.find('.config-input').eq(0).val(), $row.find('.config-unit').eq(0).val());
            const channelWidth = convertToKHz($row.find('.config-input').eq(1).val(), $row.find('.config-unit').eq(1).val());
            const channelSpacing = convertToKHz($row.find('.config-input').eq(2).val(), $row.find('.config-unit').eq(2).val());
            if (isNaN(occupiedBw) || isNaN(channelWidth) || isNaN(channelSpacing) || occupiedBw <= 0 || channelWidth <= 0 || channelSpacing <= 0) {
                isValid = false;
            }
            configs.push({ occupiedBw, channelWidth, channelSpacing });
        });

        if (!isValid) return showError('すべてのチャネル設定に正の数値を入力してください。');
        if (configs.length === 0) return showError('少なくとも1つのチャネル設定を追加してください。');

        updateUrl();

        const allChannels = [];
        const channelRanges = [];
        let channelCounter = 0;
        configs.forEach(config => {
            if (config.channelSpacing <= 0) return;
            let startChannelForConfig = -1;
            let currentCenterFreq = startFreq + (config.channelWidth / 2);
            while (currentCenterFreq + (config.channelWidth / 2) <= endFreq) {
                 if (startChannelForConfig === -1) startChannelForConfig = channelCounter;
                 allChannels.push({ centerFreq: currentCenterFreq, channelNumber: channelCounter, ...config });
                 channelCounter++;
                 currentCenterFreq += config.channelSpacing;
            }
            if (startChannelForConfig !== -1) {
                channelRanges.push({ occupiedBw: config.occupiedBw, start: startChannelForConfig, end: channelCounter - 1 });
            }
        });

        displayChannelSummary(channelRanges, channelCounter);
        const blocks = [];
        if (gridSpacing > 0) {
            for (let i = 0; startFreq + i * gridSpacing < endFreq; i++) {
                const blockStart = startFreq + i * gridSpacing;
                const blockEnd = blockStart + gridSpacing;
                const channelsInBlock = allChannels
                    .filter(ch => (ch.centerFreq - ch.channelWidth / 2) >= blockStart && (ch.centerFreq - ch.channelWidth / 2) < blockEnd)
                    .map(ch => ch.channelNumber);
                blocks.push({ blockNumber: i, channels: channelsInBlock });
            }
        }
        displayBlockSummary(blocks);
        drawChart(allChannels, startFreq, endFreq, gridSpacing);
        generateDriotConfig(startFreq, endFreq, configs, channelRanges, blocks, channelCounter);
    };

    const drawChart = (data, startFreq, endFreq, gridSpacing) => {
        const $container = $("#visualization-container");
        $container.empty();
        const margin = { top: 30, right: 50, bottom: 80, left: 100 };
        const height = 510;
        const calculatedWidth = (endFreq - startFreq) * 0.5;
        const minWidth = $container.width() - margin.left - margin.right;
        const width = Math.max(calculatedWidth, minWidth);

        const svg = d3.select("#visualization-container").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const occupiedBwDomains = [...new Set(data.map(d => d.occupiedBw))];
        const xScale = d3.scaleLinear().domain([startFreq, endFreq]).range([0, width]);
        const yScale = d3.scaleBand().domain(occupiedBwDomains).range([0, height]).padding(0.05);
        
        const gridAndLabelsGroup = svg.append("g").attr("class", "grid-and-labels-container")
            .style("display", $gridToggle.is(':checked') ? "block" : "none");

        if (gridSpacing > 0) {
            for (let i = 0; startFreq + i * gridSpacing < endFreq; i++) {
                const xPos = xScale(startFreq + i * gridSpacing);
                gridAndLabelsGroup.append("line").attr("class", "grid-line").attr("x1", xPos).attr("y1", -margin.top).attr("x2", xPos).attr("y2", height);
                if (startFreq + (i + 1) * gridSpacing <= endFreq) {
                    gridAndLabelsGroup.append("text").attr("class", "grid-label").attr("x", xScale(startFreq + (i + 0.5) * gridSpacing)).attr("y", -8).attr("text-anchor", "middle").text(`ブロック${i}`);
                }
            }
        }

        const formatFrequency = d => (d >= 1e6) ? `${d / 1e6} GHz` : (d >= 1e3 ? `${d / 1e3} MHz` : `${d} kHz`);
        const tickValues = [startFreq];
        if (gridSpacing > 0) {
            for (let i = 1; (startFreq + i * gridSpacing) < endFreq; i++) {
                tickValues.push(startFreq + i * gridSpacing);
            }
        }
        tickValues.push(endFreq);

        const xAxis = d3.axisBottom(xScale).tickValues(tickValues).tickFormat(formatFrequency);
        svg.append("g").attr("transform", `translate(0, ${height})`).call(xAxis)
            .selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-65)");
        svg.append("text").attr("class", "axis-label").attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom - 10).text("周波数");
        svg.append("g").call(d3.axisLeft(yScale).tickFormat(d => `${d.toLocaleString()} kHz`));
        svg.append("text").attr("class", "axis-label").attr("text-anchor", "middle").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -margin.left + 20).text("占有帯域幅");
        svg.append("line").attr("class", "end-line").attr("x1", xScale(endFreq)).attr("y1", 0).attr("x2", xScale(endFreq)).attr("y2", height);

        const $tooltip = $("#tooltip");
        const groupedData = d3.group(data, d => d.occupiedBw);
        const channelGroups = svg.selectAll(".channel-group").data(groupedData).enter().append("g").attr("transform", d => `translate(0, ${yScale(d[0])})`);
        const channelShapes = channelGroups.selectAll(null).data(d => d[1]).enter();

        const paths = channelShapes.append("path").attr("class", "channel").attr("d", d => {
            const bandHeight = yScale.bandwidth();
            const trapezoidHeight = bandHeight / 2;
            const y_margin = (bandHeight - trapezoidHeight) / 2;
            const y0 = y_margin + trapezoidHeight, y1 = y_margin;
            const topWidthRatio = 0.8;
            const x_bl = xScale(d.centerFreq - d.occupiedBw / 2), x_br = xScale(d.centerFreq + d.occupiedBw / 2);
            const topWidth = (x_br - x_bl) * topWidthRatio;
            const x_tl = xScale(d.centerFreq) - topWidth / 2, x_tr = xScale(d.centerFreq) + topWidth / 2;
            return `M ${x_bl},${y0} L ${x_tl},${y1} L ${x_tr},${y1} L ${x_br},${y0} Z`;
        }).attr("fill", d => colorScale(d.occupiedBw)).attr("fill-opacity", 0.5).attr("stroke", d => d3.rgb(colorScale(d.occupiedBw)).darker(0.7)).attr("stroke-width", 1);

        paths.on("mouseover", function(event, d) {
            d3.select(this).attr("fill-opacity", 0.8);
            $tooltip.html(`<strong>Ch. ${d.channelNumber}</strong><br><strong>中心周波数:</strong> ${d.centerFreq.toLocaleString()} kHz<br><strong>チャネル幅:</strong> ${d.channelWidth.toLocaleString()} kHz<br><strong>占有帯域幅:</strong> ${d.occupiedBw.toLocaleString()} kHz<br><strong>チャネルSP:</strong> ${d.channelSpacing.toLocaleString()} kHz`)
                .css({ left: (event.pageX + 15) + "px", top: (event.pageY - 28) + "px", opacity: 0.9 });
        }).on("mouseout", function() {
            d3.select(this).attr("fill-opacity", 0.5);
            $tooltip.css("opacity", 0);
        });

        channelShapes.append("text").attr("class", "channel-text").attr("x", d => xScale(d.centerFreq)).attr("y", d => yScale.bandwidth() / 2)
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle").text(d => d.channelNumber)
            .style("display", d => (xScale(d.centerFreq + d.occupiedBw / 2) - xScale(d.centerFreq - d.occupiedBw / 2)) > (String(d.channelNumber).length * 6 + 4) ? "block" : "none");
    };

    const setupExportButtons = () => {
        const getCssStyles = () => {
            let css = '';
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of (sheet.cssRules || sheet.rules)) {
                        css += rule.cssText + '\n';
                    }
                } catch (e) {
                    if (e.name !== 'SecurityError') console.error('Error reading stylesheet rules:', e);
                }
            }
            return css;
        };

        const captureSvg = () => {
            return new Promise((resolve) => {
                const svgNode = document.querySelector("#visualization-container svg");
                if (!svgNode) return resolve(null);
                const cssStyles = getCssStyles();
                const clonedSvgNode = svgNode.cloneNode(true);
                const styleElement = document.createElement("style");
                styleElement.textContent = cssStyles;
                clonedSvgNode.insertBefore(styleElement, clonedSvgNode.firstChild);
                const svgText = new XMLSerializer().serializeToString(clonedSvgNode);
                const svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgText)));
                const canvas = document.createElement("canvas");
                const svgSize = svgNode.getBoundingClientRect();
                canvas.width = svgSize.width;
                canvas.height = svgSize.height;
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const img = new Image();
                img.onload = function() {
                    ctx.drawImage(this, 0, 0, canvas.width, canvas.height);
                    resolve(canvas);
                };
                img.src = svgBase64;
            });
        };

        $('#export-png-btn').on('click', async function() {
            const canvas = await captureSvg();
            if (canvas) {
                const link = document.createElement('a');
                link.download = 'channel-layout.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        });
    };

    const serializeSettings = () => {
        const title = $('#visualization-title').val();
        const titleBytes = new TextEncoder().encode(title);

        const freqValues = new Float32Array([
            convertToKHz($('#start-freq').val(), $('#start-freq-unit').val()),
            convertToKHz($('#end-freq').val(), $('#end-freq-unit').val()),
            convertToKHz($('#grid-spacing').val(), $('#grid-spacing-unit').val())
        ]);

        const channelValues = [];
        $channelConfigsContainer.find('.config-row').each(function() {
            const $row = $(this);
            channelValues.push(convertToKHz($row.find('.config-input').eq(0).val(), $row.find('.config-unit').eq(0).val()));
            channelValues.push(convertToKHz($row.find('.config-input').eq(1).val(), $row.find('.config-unit').eq(1).val()));
            channelValues.push(convertToKHz($row.find('.config-input').eq(2).val(), $row.find('.config-unit').eq(2).val()));
        });
        const channelValuesArray = new Float32Array(channelValues);

        const version = new Uint8Array([3]);
        const titleLength = new Uint8Array([titleBytes.length]);
        const preFloatOffset = version.length + titleLength.length + titleBytes.length;
        const padding = (4 - (preFloatOffset % 4)) % 4;

        const totalLength = preFloatOffset + padding + freqValues.byteLength + channelValuesArray.byteLength;
        const buffer = new Uint8Array(totalLength);
        
        let offset = 0;
        buffer.set(version, offset);
        offset += version.length;
        buffer.set(titleLength, offset);
        offset += titleLength.length;
        buffer.set(titleBytes, offset);
        offset += titleBytes.length;
        offset += padding;

        buffer.set(new Uint8Array(freqValues.buffer), offset);
        offset += freqValues.byteLength;
        buffer.set(new Uint8Array(channelValuesArray.buffer), offset);

        const base64 = btoa(String.fromCharCode.apply(null, buffer));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const deserializeSettings = (base64String) => {
        try {
            let base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) {
                base64 += '=';
            }

            const binaryString = atob(base64);
            const buffer = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                buffer[i] = binaryString.charCodeAt(i);
            }

            let offset = 0;
            const version = buffer[offset++];
            
            if (version !== 3) {
                showError("非対応の設定バージョンです。URLが古いか、破損している可能性があります。");
                return null;
            }

            const titleLength = buffer[offset++];
            const titleBytes = buffer.slice(offset, offset + titleLength);
            const title = new TextDecoder().decode(titleBytes);
            offset += titleLength;
            const padding = (4 - (offset % 4)) % 4;
            offset += padding;

            const freqValuesByteLength = 3 * 4;
            if (offset + freqValuesByteLength > buffer.byteLength) throw new Error("Invalid data length for frequency values.");
            const freqValuesBuffer = buffer.buffer.slice(offset, offset + freqValuesByteLength);
            const freqValues = new Float32Array(freqValuesBuffer);
            offset += freqValuesByteLength;

            const remainingBytes = buffer.byteLength - offset;
            if (remainingBytes < 0) throw new Error("Invalid data length.");
            const channelValuesBuffer = buffer.buffer.slice(offset, offset + remainingBytes);
            if (channelValuesBuffer.byteLength % 4 !== 0) throw new Error("Channel data byte length is not a multiple of 4.");
            const channelValues = new Float32Array(channelValuesBuffer);

            return { title, freqValues, channelValues };
        } catch (e) {
            console.error("Failed to deserialize settings:", e);
            showError("設定の読み込みに失敗しました。データが破損している可能性があります。");
            return null;
        }
    };

    const applySettings = (settings) => {
        if (settings.title) {
            $('#visualization-title').val(settings.title);
        }
        $('#start-freq').val(settings.freqValues[0]);
        $('#start-freq-unit').val('kHz');
        $('#end-freq').val(settings.freqValues[1]);
        $('#end-freq-unit').val('kHz');
        $('#grid-spacing').val(settings.freqValues[2]);
        $('#grid-spacing-unit').val('kHz');

        $channelConfigsContainer.empty();
        for (let i = 0; i < settings.channelValues.length; i += 3) {
            createChannelConfigRow({
                occupiedBw: { value: settings.channelValues[i], unit: 'kHz' },
                channelWidth: { value: settings.channelValues[i+1], unit: 'kHz' },
                channelSpacing: { value: settings.channelValues[i+2], unit: 'kHz' }
            });
        }
    };

    const loadSettings = () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const settings = deserializeSettings(hash);
            if (settings) {
                applySettings(settings);
            }
        } else {
            addInitialConfigs();
        }
    };

    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const debouncedUpdate = debounce(updateVisualization, 300);

    const setupEventHandlers = () => {
        // Automatic updates on input change
        $('#content-freq-grid, #channel-configs-container, #grid-toggle, #visualization-title').on('input change', 'input, select', debouncedUpdate);
        
        // Button clicks that trigger an update
        $('#add-channel-btn-bottom').on('click', () => {
            createChannelConfigRow();
            debouncedUpdate();
        });

        $channelConfigsContainer.on('click', '.remove-btn', function() {
            $(this).closest('.config-row').remove();
            updateMoveButtonsState();
            debouncedUpdate();
        });

        $channelConfigsContainer.on('click', '.move-up-btn', function() {
            const $row = $(this).closest('.config-row');
            $row.prev().before($row);
            updateMoveButtonsState();
            debouncedUpdate();
        });

        $channelConfigsContainer.on('click', '.move-down-btn', function() {
            const $row = $(this).closest('.config-row');
            $row.next().after($row);
            updateMoveButtonsState();
            debouncedUpdate();
        });

        // Title editing with Enter key
        $('#visualization-title').on('keydown', function(e) {
            if (e.key === 'Enter') {
                $(this).blur();
            }
        });

        // Copy URL button
        $('#copy-url-btn').on('click', function() {
            navigator.clipboard.writeText($('#share-url').val()).then(() => {
                const $feedback = $('#copy-feedback');
                $feedback.fadeIn();
                setTimeout(() => $feedback.fadeOut(), 2000);
            });
        });

        // Copy Config button
        $('#copy-config-btn').on('click', function() {
            navigator.clipboard.writeText($('#driot-config-output').val()).then(() => {
                const $feedback = $('#copy-config-feedback');
                $feedback.fadeIn();
                setTimeout(() => $feedback.fadeOut(), 2000);
            });
        });
    };
    
    // Initial setup
    setupCollapsibleSections();
    setupExportButtons();
    loadSettings();
    setupEventHandlers();
    updateVisualization(); // Initial draw
});