'use strict';
var defaults = require('../core/core.defaults');
var helpers = require('../helpers/index');
var scales = require('../core/core.scale');

function parseFontOptions(options) {
	var valueOrDefault = helpers.valueOrDefault;
	var globalDefaults = defaults.global;
	var size = valueOrDefault(options.fontSize, globalDefaults.defaultFontSize);
	var style = valueOrDefault(options.fontStyle, globalDefaults.defaultFontStyle);
	var family = valueOrDefault(options.fontFamily, globalDefaults.defaultFontFamily);

	return {
		size: size,
		style: style,
		family: family,
		font: helpers.fontString(size, style, family)
	};
}

module.exports = function(Chart) {

	// Default config for a category scale
	var defaultConfig = {
		position: 'bottom',
		// offset settings
		offset: true,

		// grid line settings
		gridLines: {
			offsetGridLines: true,
			drawTicks: true,
			tickMarkLength: 5
		},

		ticks: {
			display: true,
			labelOffset: 0,
			padding: 10, // grid from ticks distance
			minRotation: 0
		},

		dataTable: {
			display: true,
			lineWidth: 0.1,
			color: "rgba(0,0,0,1.0)"
		},

		fullWidth: true
	};

	var getLabelsMaxTextHeightPixels = function(scale) {

		var optionTicks = scale.options.ticks.minor;
		var tickFont = parseFontOptions(optionTicks);

		var angleRadians = helpers.toRadians(scale.labelRotation);
		var cosRotation = Math.cos(angleRadians);
		var sinRotation = Math.sin(angleRadians);
		var largestTextWidth = helpers.longestText(scale.ctx, tickFont.font, scale.getLabels(), scale.longestTextCache);

		return sinRotation * largestTextWidth;
	};

	var getLabelTextHeightPixels = function(scale, label) {

		var optionTicks = scale.options.ticks.minor;
		var tickFont = parseFontOptions(optionTicks);

		var angleRadians = helpers.toRadians(scale.labelRotation);
		var cosRotation = Math.cos(angleRadians);
		var sinRotation = Math.sin(angleRadians);
		var largestTextWidth = helpers.longestText(scale.ctx, tickFont.font, [label], scale.longestTextCache);

		return sinRotation * largestTextWidth;
	};

	var DatasetScale = Chart.Scale.extend({

		offsetByTickLength: function() {
			var gridOptions = this.getGridLineOptions();
			return gridOptions.drawTicks ? gridOptions.tickMarkLength : 0;
		},

		getGridLineOptions: function () {
			return this.options.gridLines;
		},

		getDataTableOptions: function () {
			return this.options.dataTable;
		},

		getScaleLabelOptions: function () {
			return this.options.scaleLabel;
		},

		getMinorTickOptions: function () {
			return this.options.ticks.minor;
		},

		getMajorTickOptions: function () {
			return this.options.ticks.major;
		},

		getMinorTickFontOptions: function () {
			return parseFontOptions(this.options.ticks.minor);
		},

		getMajorTickFontOptions: function () {
			return parseFontOptions(this.options.ticks.major || this.options.ticks.minor);
		},

		getLineValue: function (index, offsetGridLines) {
			var me = this;
			var lineValue = me.getPixelForTick(index);

			if (offsetGridLines) {
				if (index === 0) {
					lineValue -= (me.getPixelForTick(1) - lineValue) / 2;
				} else {
					lineValue -= (lineValue - me.getPixelForTick(index - 1)) / 2;
				}
			}

			return lineValue;
		},

		/**
		 * Internal function to get the correct labels. If data.xLabels or data.yLabels are defined, use those
		 * else fall back to data.labels
		 * @private
		 */
		getLabels: function() {
			var me = this;
			var data = this.chart.data;
			var labels = this.options.labels || (this.isHorizontal() ? data.xLabels : data.yLabels) || data.labels;
			// labels = labels.map(function(a,index) {
			// 	var temp = me.getLabelData(index);
			// 	return [a].concat(temp);
			// });
			return labels;
		},

		getLabelData: function(index) {
			var me = this;
			var data = me.chart.data;
			var unhiddenDataSets = me.chart.legend.legendItems
				.filter(function(l) { return !l.hidden; })
				.map(function(l) { return l.text; });

			var isUnhidden = function(label) {
				return unhiddenDataSets.filter(function(l) { return l === label; }).length > 0;
			};

			return data.datasets
				.filter(function (d) {
					return isUnhidden(d.label);
				})
				.map(function (d) {
					return d.data[index];
				});
		},

		getVisibleDataSets: function() {
			var me = this;
			var data = me.chart.data;
			var unhiddenDataSets = me.chart.legend.legendItems
				.filter(function(l) { return !l.hidden; })
				.map(function(l) { return l.text; });

			var isUnhidden = function(label) {
				return unhiddenDataSets.filter(function(l) { return l === label; }).length > 0;
			};

			return data.datasets
				.filter(function (d) {
					return isUnhidden(d.label);
				});
		},

		getLabelDataDim: function() {
			var me = this;
			var unhiddenDataSets = me.chart.legend.legendItems
				.filter(function(l) { return !l.hidden; })
				.map(function(l) { return l.text; });

			return { n: unhiddenDataSets.length, m: me.getLabels().length };
		},

		determineDataLimits: function() {
			var me = this;
			var labels = me.getLabels();
			me.minIndex = 0;
			me.maxIndex = labels.length - 1;
			var findIndex;

			if (me.options.ticks.min !== undefined) {
				// user specified min value
				findIndex = labels.indexOf(me.options.ticks.min);
				me.minIndex = findIndex !== -1 ? findIndex : me.minIndex;
			}

			if (me.options.ticks.max !== undefined) {
				// user specified max value
				findIndex = labels.indexOf(me.options.ticks.max);
				me.maxIndex = findIndex !== -1 ? findIndex : me.maxIndex;
			}

			me.min = labels[me.minIndex];
			me.max = labels[me.maxIndex];
		},

		buildTicks: function() {
			var me = this;
			var labels = me.getLabels();
			// If we are viewing some subset of labels, slice the original array
			me.ticks = (me.minIndex === 0 && me.maxIndex === labels.length - 1) ? labels : labels.slice(me.minIndex, me.maxIndex + 1);
		},

		// getLabelForIndex: function(index, datasetIndex) {
		// 	var me = this;
		// 	var data = me.chart.data;
		// 	var isHorizontal = me.isHorizontal();
        //
		// 	if (data.yLabels && !isHorizontal) {
		// 		return me.getRightValue(data.datasets[datasetIndex].data[index]);
		// 	}
		// 	return me.ticks[index - me.minIndex];
		// },

		// Used to get data value locations.  Value can either be an index or a numerical value
		// This is the center of each of the label data.
		getPixelForValue: function(value, index) {
			var me = this;
			var offset = me.options.offset;
			if (me.isHorizontal()) {
				// The max text width of each visible dataSet shall be taken
				// TODO: use caching to speed up
				var dataSetLabelMaxLength = helpers.longestText(me.ctx,
					me.getMinorTickFontOptions().font,
					me.getVisibleDataSets().map(function (ds) {
						return ds.label;
					}),
					null);

				// First reduce data table row label (data set label) width for tick width
				var innerWidth = me.width - (me.paddingLeft + me.paddingRight) - dataSetLabelMaxLength;
				var tickWidth = innerWidth / Math.max((me._ticks.length - (offset ? 0 : 1)), 1);
				var pixel = (tickWidth * index) + me.paddingLeft;

				// Offset ticks add half a tickWidth.
				if (offset) {
					pixel += tickWidth / 2;
				}

				// As per the options.layout.padding.left, we
				// get the offset on me.left, which breaks
				// the layout of the datatable
				var finalVal = me.left + Math.round(pixel);
				//var finalVal = Math.round(pixel);
				finalVal += me.isFullWidth() ? me.margins.left : 0;

				// Add offset due to the data table row label (data set label)
				finalVal += dataSetLabelMaxLength;

				return finalVal;
			}
			var innerHeight = me.height - (me.paddingTop + me.paddingBottom);
			return me.top + (index * (innerHeight / (me._ticks.length - 1)));
		},

		getPixelForTick: function(index) {
			return this.getPixelForValue(this.ticks[index], index + this.minIndex);
		},

		// getValueForPixel: function(pixel) {
		// 	var me = this;
		// 	var offset = me.options.offset;
		// 	var value;
		// 	var offsetAmt = Math.max((me._ticks.length - (offset ? 0 : 1)), 1);
		// 	var horz = me.isHorizontal();
		// 	var valueDimension = (horz ? me.width : me.height) / offsetAmt;
        //
		// 	pixel -= horz ? me.left : me.top;
        //
		// 	if (offset) {
		// 		pixel -= (valueDimension / 2);
		// 	}
        //
		// 	if (pixel <= 0) {
		// 		value = 0;
		// 	} else {
		// 		value = Math.round(pixel / valueDimension);
		// 	}
        //
		// 	return value + me.minIndex;
		// },

		getBasePixel: function() {
			return this.bottom;
		},

		afterFit: function() {
			var me = this;

			var tickOpts = me.options.ticks;
			var tickFont = parseFontOptions(tickOpts);

			var dataSets = me.getVisibleDataSets();
			var lineSpace = tickFont.size * 0.5;
			var tallestLabelHeightInLines = dataSets.length;

			var labelHeight = tickFont.size * tallestLabelHeightInLines
				+ lineSpace * tallestLabelHeightInLines;

			me.minSize.height += labelHeight;
			me.height += labelHeight;
		},

		// Actually draw the scale on the canvas
		// @param {rectangle} chartArea : the area of the chart to draw full grid lines on
		draw: function(chartArea) {
			var me = this;
			var options = me.options;
			if (!options.display) {
				return;
			}

			var globalDefaults = defaults.global;
			var optionTicks = options.ticks.minor;
			var gridLines = options.gridLines;
			var scaleLabel = options.scaleLabel;
			var dataTable = options.dataTable;

			var isRotated = me.labelRotation !== 0;
			var isHorizontal = me.isHorizontal();

			var labelRotationRadians = helpers.toRadians(me.labelRotation);

			var tl = me.offsetByTickLength();

			var xTickStart = options.position === 'right' ? me.left : me.right - tl;
			var xTickEnd = options.position === 'right' ? me.left + tl : me.right;
			var yTickStart = options.position === 'bottom' ? me.top : me.bottom - tl;
			var yTickEnd = options.position === 'bottom' ? me.top + tl : me.bottom;

			var ticks = optionTicks.autoSkip ? me._autoSkip(me.getTicks()) : me.getTicks();
			var itemsToDraw = [];
			helpers.each(ticks, function(tick, index) {
				// autoskipper skipped this tick (#4635)
				if (tick.label === undefined) {
					return;
				}

				var lineWidth, lineColor, borderDash, borderDashOffset;
				if (index === me.zeroLineIndex && options.offset === gridLines.offsetGridLines) {
					// Draw the first index specially
					lineWidth = gridLines.zeroLineWidth;
					lineColor = gridLines.zeroLineColor;
					borderDash = gridLines.zeroLineBorderDash;
					borderDashOffset = gridLines.zeroLineBorderDashOffset;
				} else {
					lineWidth = helpers.valueAtIndexOrDefault(gridLines.lineWidth, index);
					lineColor = helpers.valueAtIndexOrDefault(gridLines.color, index);
					borderDash = helpers.valueOrDefault(gridLines.borderDash, globalDefaults.borderDash);
					borderDashOffset = helpers.valueOrDefault(gridLines.borderDashOffset, globalDefaults.borderDashOffset);
				}

				// Common properties
				var tx1, ty1, tx2, ty2, x1, y1, x2, y2, labelX, labelY;
				var textAlign = 'middle';
				var textBaseline = 'middle';
				var tickPadding = optionTicks.padding;

				if (isHorizontal) {
					var labelYOffset = me.offsetByTickLength() + tickPadding;
					var magicOffset = 3; // TODO MAGIC
					if (options.position === 'bottom') {
						// bottom
						textBaseline = 'top'; // !isRotated ? 'top' : 'middle';
						textAlign = 'center'; // !isRotated ? 'center' : 'right';
						labelY = me.top + labelYOffset + magicOffset + getLabelTextHeightPixels(me, tick.label)/2;
					} else {
						// top
						textBaseline = !isRotated ? 'bottom' : 'middle';
						textAlign = !isRotated ? 'center' : 'left';
						labelY = me.bottom - labelYOffset - magicOffset - getLabelTextHeightPixels(me, tick.label)/2;
					}

					var xLineValue = me.getLineValue(index, gridLines.offsetGridLines && ticks.length > 0);
					if (xLineValue < me.left) {
						lineColor = 'rgba(0,0,0,0)';
					}
					xLineValue += helpers.aliasPixel(lineWidth);

					labelX = me.getPixelForTick(index) + optionTicks.labelOffset; // x values for optionTicks (need to consider offsetLabel option)

					tx1 = tx2 = x1 = x2 = xLineValue;
					ty1 = yTickStart;
					ty2 = yTickEnd;
					y1 = chartArea.top;
					y2 = chartArea.bottom;
				} else { // TODO: VERTICAL
					var isLeft = options.position === 'left';
					var labelXOffset;

					if (optionTicks.mirror) {
						textAlign = isLeft ? 'left' : 'right';
						labelXOffset = tickPadding;
					} else {
						textAlign = isLeft ? 'right' : 'left';
						labelXOffset = tl + tickPadding;
					}

					labelX = isLeft ? me.right - labelXOffset : me.left + labelXOffset;

					var yLineValue = me.getLineValue(index, gridLines.offsetGridLines && ticks.length > 1);
					if (yLineValue < me.top) {
						lineColor = 'rgba(0,0,0,0)';
					}
					yLineValue += helpers.aliasPixel(lineWidth);

					labelY = me.getPixelForTick(index) + optionTicks.labelOffset;

					tx1 = xTickStart;
					tx2 = xTickEnd;
					x1 = chartArea.left;
					x2 = chartArea.right;
					ty1 = ty2 = y1 = y2 = yLineValue;
				}

				itemsToDraw.push({
					tx1: tx1,
					ty1: ty1,
					tx2: tx2,
					ty2: ty2,
					x1: x1,
					y1: y1,
					x2: x2,
					y2: y2,
					labelX: labelX,
					labelY: labelY,
					glWidth: lineWidth,
					glColor: lineColor,
					glBorderDash: borderDash,
					glBorderDashOffset: borderDashOffset,
					rotation: -1 * labelRotationRadians,
					label: tick.label,
					major: true, // because of datatable we want special significance
					textBaseline: textBaseline,
					textAlign: textAlign
				});
			});

			// Draw all of the tick labels, tick marks, and grid lines at the correct places
			var key;
			for(key in itemsToDraw)
				me.drawTick(itemsToDraw[key]);

			if (dataTable.display && me.getLabelDataDim().n > 0)
				me.drawDataTable();

			if (scaleLabel.display)
				me.drawScaleLabels();

			if (gridLines.drawBorder)
				me.drawGridLineBorder();
		},

		drawTick: function(tickToDraw) {
			var me = this;
			var grindLinesOptions = me.getGridLineOptions();
			var minorTickOptions = me.getMinorTickOptions();
			var minorTickFontColor = helpers.valueOrDefault(minorTickOptions.fontColor, defaults.global.defaultFontColor);
			var minorTickFontOptions = me.getMinorTickFontOptions();

			var majorTickOptions = me.getMajorTickOptions();
			var majorTickFontColor = helpers.valueOrDefault(majorTickOptions.fontColor, defaults.global.defaultFontColor);
			var majorTickFontOptions = me.getMajorTickFontOptions();

			if (grindLinesOptions.display) {
				me.ctx.save();
				me.ctx.lineWidth = tickToDraw.glWidth;
				me.ctx.strokeStyle = tickToDraw.glColor;
				if (me.ctx.setLineDash) {
					me.ctx.setLineDash(tickToDraw.glBorderDash);
					me.ctx.lineDashOffset = tickToDraw.glBorderDashOffset;
				}

				me.ctx.beginPath();

				if (grindLinesOptions.drawTicks) {
					me.ctx.moveTo(tickToDraw.tx1, tickToDraw.ty1);
					me.ctx.lineTo(tickToDraw.tx2, tickToDraw.ty2);
				}

				if (grindLinesOptions.drawOnChartArea) {
					me.ctx.moveTo(tickToDraw.x1, tickToDraw.y1);
					me.ctx.lineTo(tickToDraw.x2, tickToDraw.y2);
				}

				me.ctx.stroke();
				me.ctx.restore();
			}

			if (minorTickOptions.display) {
				// Make sure we draw text in the correct color and font
				me.ctx.save();
				me.ctx.translate(tickToDraw.labelX, tickToDraw.labelY);
				me.ctx.rotate(tickToDraw.rotation);
				me.ctx.font = tickToDraw.major ? majorTickFontOptions.font : minorTickFontOptions.font;
				me.ctx.fillStyle = tickToDraw.major ? majorTickFontColor : minorTickFontColor;
				me.ctx.textBaseline = tickToDraw.textBaseline;
				me.ctx.textAlign = tickToDraw.textAlign;

				var label = tickToDraw.label;
				if (helpers.isArray(label)) {
					for (var i = 0, y = 0; i < label.length; ++i) {
						// We just make sure the multiline element is a string here..
						me.ctx.fillText('' + label[i], 0, y);
						// apply same lineSpacing as calculated @ L#320
						y += (minorTickFontOptions.size * 1.5);
					}
				} else {
					me.ctx.fillText(label, 0, 0);
				}
				me.ctx.restore();
			}
		},

		getYDataTableRow: function(row) {
			var me = this;

			// these three lines are equivalent to the draw computation in the labelY value
			var offset = me.options.position === 'bottom' ? me.options.ticks.minor.padding : 0;
			var labelYOffset = me.offsetByTickLength() + offset;
			var magicOffset = 0;

			// This next line takes into account the rotation of the tick labels
			var rotationExtra = row > 0 ? getLabelsMaxTextHeightPixels(me) : 0;

			//
			var rowYOffset = me.getMinorTickFontOptions().size * 1.5 * row;

			return  me.top + labelYOffset+ magicOffset + rotationExtra + rowYOffset;
		},

		getXDataTableColumn: function(col) {
			var me = this;
			return col === -1
				? me.left
				: me.getLineValue(col, me.getGridLineOptions().offsetGridLines && me.getLabelDataDim().m > 0)
				+ helpers.aliasPixel(me.getGridLineOptions().zeroLineWidth);
		},

		getXYDataTableCellText: function(n, m) {
			var me = this;
			var x = (me.getXDataTableColumn(n - 1) + me.getXDataTableColumn(n))/2;
			var y = me.getYDataTableRow(m + 2) - 2;
			return { x: x, y: y }
		},

		drawDataTable: function () {
			var me = this;

			// Draw the line at the edge of the axis
			me.ctx.lineWidth = helpers.valueOrDefault(me.getDataTableOptions().lineWidth, 0.1);
			me.ctx.strokeStyle = helpers.valueOrDefault(me.getDataTableOptions().color, 0);
			me.ctx.font = me.getMajorTickFontOptions().font;
			me.ctx.textBaseline = 'bottom';
			me.ctx.textAlign = 'center';

			// Data Set Labels (Row Labels)
			var visibleDataSets = me.getVisibleDataSets();

			var i;
			for (i = 0; i < visibleDataSets.length; i++) {
				var dataSet = visibleDataSets[i];
				me.ctx.fillStyle = dataSet.backgroundColor;
				var textPos = me.getXYDataTableCellText(0,i);
				me.ctx.fillText(dataSet.label, textPos.x, textPos.y);
				for (var j = 0; j < dataSet.data.length; j++) {
					me.ctx.fillStyle = dataSet.backgroundColor;
					textPos = me.getXYDataTableCellText(j + 1,i);
					me.ctx.fillText(dataSet.data[j], textPos.x, textPos.y);
				}
			}

			// Horizontal Lines
			var tableDim = me.getLabelDataDim();
			me.ctx.beginPath();
			var right = me.getXDataTableColumn(tableDim.m);
			for(i = 0; i <= tableDim.n + 1; i++) {
				var left = i === 0 ? me.getXDataTableColumn(0) : tableDim.n === 0 ? me.getXDataTableColumn(0) : me.getXDataTableColumn(-1);
				var y = me.getYDataTableRow(i);
				me.ctx.moveTo(left, y);
				me.ctx.lineTo(right, y);
			}

			// Vertical Lines
			var cellX = me.getXDataTableColumn(-1);
			me.ctx.moveTo(cellX, me.getYDataTableRow(1));
			me.ctx.lineTo(cellX, me.getYDataTableRow(tableDim.n + 1));
			var yStart = me.getYDataTableRow(0);
			var yEnd = me.getYDataTableRow(tableDim.n + 1);
			for(i = 0; i <= tableDim.m + 1; i++) {
				cellX = me.getXDataTableColumn(i);
				me.ctx.moveTo(cellX, yStart);
				me.ctx.lineTo(cellX, yEnd);
			}

			// Draw
			if (me.getDataTableOptions().lineWidth !== 0) me.ctx.stroke();
			else me.ctx.restore();
		},

		drawScaleLabels: function() {
			var me = this;
			var scaleLabelOptions = me.getScaleLabelOptions();
			var scaleLabelPadding = helpers.options.toPadding(scaleLabelOptions.padding);
			var scaleLabelFont = parseFontOptions(scaleLabelOptions);
			var scaleLabelFontColor = helpers.valueOrDefault(scaleLabelOptions.fontColor, defaults.global.defaultFontColor);

			// Draw the scale label
			var scaleLabelX;
			var scaleLabelY;
			var rotation = 0;
			var halfLineHeight = parseLineHeight(scaleLabelOptions) / 2;

			if (me.isHorizontal()) {
				scaleLabelX = me.left + ((me.right - me.left) / 2); // midpoint of the width
				scaleLabelY = options.position === 'bottom'
					? me.bottom - halfLineHeight - scaleLabelPadding.bottom
					: me.top + halfLineHeight + scaleLabelPadding.top;
			} else {
				var isLeft = options.position === 'left';
				scaleLabelX = isLeft
					? me.left + halfLineHeight + scaleLabelPadding.top
					: me.right - halfLineHeight - scaleLabelPadding.top;
				scaleLabelY = me.top + ((me.bottom - me.top) / 2);
				rotation = isLeft ? -0.5 * Math.PI : 0.5 * Math.PI;
			}

			me.ctx.save();
			me.ctx.translate(scaleLabelX, scaleLabelY);
			me.ctx.rotate(rotation);
			me.ctx.textAlign = 'center';
			me.ctx.textBaseline = 'middle';
			me.ctx.fillStyle = scaleLabelFontColor; // render in correct colour
			me.ctx.font = scaleLabelFont.font;
			me.ctx.fillText(scaleLabelOptions.labelString, 0, 0);
			me.ctx.restore();
		},

		drawGridLineBorder: function () {
			var me = this;
			var gridLinesOptions = me.getGridLineOptions();

			// Draw the line at the edge of the axis
			me.ctx.lineWidth = helpers.valueAtIndexOrDefault(gridLinesOptions.lineWidth, 0);
			me.ctx.strokeStyle = helpers.valueAtIndexOrDefault(gridLinesOptions.color, 0);
			var x1 = me.left;
			var x2 = me.right;
			var y1 = me.top;
			var y2 = me.bottom;

			var aliasPixel = helpers.aliasPixel(me.ctx.lineWidth);
			if (me.isHorizontal()) {
				y1 = y2 = me.options.position === 'top' ? me.bottom : me.top;
				y1 += aliasPixel;
				y2 += aliasPixel;
			} else {
				x1 = x2 = me.options.position === 'left' ? me.right : me.left;
				x1 += aliasPixel;
				x2 += aliasPixel;
			}

			me.ctx.beginPath();
			me.ctx.moveTo(x1, y1);
			me.ctx.lineTo(x2, y2);
			me.ctx.stroke();
		}
	});

	Chart.scaleService.registerScaleType('datatable', DatasetScale, defaultConfig);

};
