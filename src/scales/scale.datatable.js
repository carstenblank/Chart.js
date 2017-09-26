'use strict';
var defaults = require('../core/core.defaults');
var helpers = require('../helpers/index');
var scales = require('../core/core.scale');

function getLineValue(scale, index, offsetGridLines) {
	var lineValue = scale.getPixelForTick(index);

	if (offsetGridLines) {
		if (index === 0) {
			lineValue -= (scale.getPixelForTick(1) - lineValue) / 2;
		} else {
			lineValue -= (lineValue - scale.getPixelForTick(index - 1)) / 2;
		}
	}

	return lineValue;
}

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
			offsetGridLines: true
		},

		ticks: {
			padding: 10
		},

		dataTable: {
			padding: 10
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
			// var me = this;
			// // offset: label on tick or between two ticks
			// var offset = me.options.offset;
			// // 1 is added because we need the length but we have the indexes
			// var offsetAmt = Math.max((me.maxIndex + 1 - me.minIndex - (offset ? 0 : 1)), 1);
            //
			// // If value is a data object, then index is the index in the data array,
			// // not the index of the scale. We need to change that.
			// // var valueCategory;
			// // if (value !== undefined && value !== null) {
			// // 	valueCategory = me.isHorizontal() ? value.x : value.y;
			// // }
			// // if (valueCategory !== undefined || (value !== undefined && isNaN(index))) {
			// // 	var labels = me.getLabels();
			// // 	value = valueCategory || value;
			// // 	var idx = labels.indexOf(value);
			// // 	index = idx !== -1 ? idx : index;
			// // }
            //
			// if (me.isHorizontal()) {
			// 	var valueWidth = me.width / offsetAmt;
			// 	var widthOffset = (valueWidth * (index - me.minIndex));
            //
			// 	if (offset) {
			// 		widthOffset += (valueWidth / 2);
			// 	}
            //
			// 	return me.left + Math.round(widthOffset);
			// }
			// var valueHeight = me.height / offsetAmt;
			// var heightOffset = (valueHeight * (index - me.minIndex));
            //
			// if (offset) {
			// 	heightOffset += (valueHeight / 2);
			// }
            //
			// return me.top + Math.round(heightOffset);

			var me = this;
			var offset = me.options.offset;
			if (me.isHorizontal()) {
				var innerWidth = me.width - (me.paddingLeft + me.paddingRight);
				var tickWidth = innerWidth / Math.max((me._ticks.length - (offset ? 0 : 1)), 1);
				var pixel = (tickWidth * index) + me.paddingLeft;

				if (offset) {
					pixel += tickWidth / 2;
				}

				// As per the options.layout.padding.left, we
				// get the offset on me.left, which breaks
				// the layout of the datatable
				var finalVal = me.left + Math.round(pixel);
				//var finalVal = Math.round(pixel);
				finalVal += me.isFullWidth() ? me.margins.left : 0;
				return finalVal;
			}
			var innerHeight = me.height - (me.paddingTop + me.paddingBottom);
			return me.top + (index * (innerHeight / (me._ticks.length - 1)));
		},

		getPixelForTick: function(index) {
			return this.getPixelForValue(this.ticks[index], index + this.minIndex, null);
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

			var context = me.ctx;
			var globalDefaults = defaults.global;
			var optionTicks = options.ticks.minor;
			var optionMajorTicks = options.ticks.major || optionTicks;
			var gridLines = options.gridLines;
			var scaleLabel = options.scaleLabel;
			var dataTable = options.dataTable;

			var isRotated = me.labelRotation !== 0;
			var isHorizontal = me.isHorizontal();

			var ticks = optionTicks.autoSkip ? me._autoSkip(me.getTicks()) : me.getTicks();
			var tickFontColor = helpers.valueOrDefault(optionTicks.fontColor, globalDefaults.defaultFontColor);
			var tickFont = parseFontOptions(optionTicks);
			var majorTickFontColor = helpers.valueOrDefault(optionMajorTicks.fontColor, globalDefaults.defaultFontColor);
			var majorTickFont = parseFontOptions(optionMajorTicks);

			var tl = gridLines.drawTicks ? gridLines.tickMarkLength : 0;

			var scaleLabelFontColor = helpers.valueOrDefault(scaleLabel.fontColor, globalDefaults.defaultFontColor);
			var scaleLabelFont = parseFontOptions(scaleLabel);
			var scaleLabelPadding = helpers.options.toPadding(scaleLabel.padding);
			var labelRotationRadians = helpers.toRadians(me.labelRotation);

			var itemsToDraw = [];

			var xTickStart = options.position === 'right' ? me.left : me.right - tl;
			var xTickEnd = options.position === 'right' ? me.left + tl : me.right;
			var yTickStart = options.position === 'bottom' ? me.top : me.bottom - tl;
			var yTickEnd = options.position === 'bottom' ? me.top + tl : me.bottom;

			helpers.each(ticks, function(tick, index) {
				// autoskipper skipped this tick (#4635)
				if (tick.label === undefined) {
					return;
				}

				var label = tick.label;
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
					var labelYOffset = tl + tickPadding;
					var magicOffset = 3; // TODO MAGIC
					if (options.position === 'bottom') {
						// bottom
						textBaseline = 'top'; // !isRotated ? 'top' : 'middle';
						textAlign = 'center'; // !isRotated ? 'center' : 'right';
						labelY = me.top + labelYOffset + magicOffset + getLabelTextHeightPixels(me, label)/2;
					} else {
						// top
						textBaseline = !isRotated ? 'bottom' : 'middle';
						textAlign = !isRotated ? 'center' : 'left';
						labelY = me.bottom - labelYOffset - magicOffset - getLabelTextHeightPixels(me, label)/2;
					}

					var xLineValue = getLineValue(me, index, gridLines.offsetGridLines && ticks.length > 1);
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

					var yLineValue = getLineValue(me, index, gridLines.offsetGridLines && ticks.length > 1);
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
					label: label,
					major: tick.major,
					textBaseline: textBaseline,
					textAlign: textAlign
				});
			});

			// Draw all of the tick labels, tick marks, and grid lines at the correct places
			helpers.each(itemsToDraw, function(itemToDraw) {
				if (gridLines.display) {
					context.save();
					context.lineWidth = itemToDraw.glWidth;
					context.strokeStyle = itemToDraw.glColor;
					if (context.setLineDash) {
						context.setLineDash(itemToDraw.glBorderDash);
						context.lineDashOffset = itemToDraw.glBorderDashOffset;
					}

					context.beginPath();

					if (gridLines.drawTicks) {
						context.moveTo(itemToDraw.tx1, itemToDraw.ty1);
						context.lineTo(itemToDraw.tx2, itemToDraw.ty2);
					}

					if (gridLines.drawOnChartArea) {
						context.moveTo(itemToDraw.x1, itemToDraw.y1);
						context.lineTo(itemToDraw.x2, itemToDraw.y2);
					}

					context.stroke();
					context.restore();
				}

				if (optionTicks.display) {
					// Make sure we draw text in the correct color and font
					context.save();
					context.translate(itemToDraw.labelX, itemToDraw.labelY);
					context.rotate(itemToDraw.rotation);
					context.font = itemToDraw.major ? majorTickFont.font : tickFont.font;
					context.fillStyle = itemToDraw.major ? majorTickFontColor : tickFontColor;
					context.textBaseline = itemToDraw.textBaseline;
					context.textAlign = itemToDraw.textAlign;

					var label = itemToDraw.label;
					if (helpers.isArray(label)) {
						for (var i = 0, y = 0; i < label.length; ++i) {
							// We just make sure the multiline element is a string here..
							context.fillText('' + label[i], 0, y);
							// apply same lineSpacing as calculated @ L#320
							y += (tickFont.size * 1.5);
						}
					} else {
						context.fillText(label, 0, 0);
					}
					context.restore();
				}
			});

			var tableDim = me.getLabelDataDim();
			if (dataTable.display && tableDim.n > 0) {
				// Draw the line at the edge of the axis
				context.lineWidth = helpers.valueOrDefault(dataTable.lineWidth, 0.1);
				context.strokeStyle = helpers.valueOrDefault(dataTable.color, 0);
				ticks = me.getTicks();


				var pixelsRow = function(row) {
					var rotationExtra = row > 0 ? getLabelsMaxTextHeightPixels(me) : 0;
					var offset = options.position === 'bottom' ? optionTicks.padding : 0;
					return  me.top + tl + tickFont.size * 1.5 * row + offset + rotationExtra;
				};

				var pixelsColumn = function(col) {
					return col === -1
						? me.left
						: getLineValue(me, col, gridLines.offsetGridLines && tableDim.m > 1) + helpers.aliasPixel(gridLines.zeroLineWidth);
				};

				var cellTextPos = function(n,m) {
					return { x: (pixelsColumn(n - 1) + pixelsColumn(n))/2, y: (pixelsRow(m + 1) + pixelsRow(m + 2))/2 }
				};

				var i;
				// Row Labels
				var dataSets = me.getVisibleDataSets();
				context.font = majorTickFont.font;
				context.textBaseline = 'center';
				context.textAlign = 'center';
				for (i = 0; i < dataSets.length; i++) {
					var dataSet = dataSets[i];
					context.fillStyle = dataSet.borderColor;
					var textPos = cellTextPos(0,i);
					context.fillText(dataSet.label, textPos.x, textPos.y);
					for (var j = 0; j < dataSet.data.length; j++) {
						context.fillStyle = tickFontColor;
						textPos = cellTextPos(j + 1,i);
						context.fillText(dataSet.data[j], textPos.x, textPos.y);
					}
				}

				// Horizontal Lines
				context.beginPath();
				var right = pixelsColumn(tableDim.m);
				for(i = 0; i <= tableDim.n + 1; i++) {
					var left = i === 0 ? pixelsColumn(0) : tableDim.n === 0 ? pixelsColumn(0) : pixelsColumn(-1);
					var y = pixelsRow(i);
					context.moveTo(left, y);
					context.lineTo(right, y);
				}

				// Vertical Lines
				var cellX = pixelsColumn(-1);
				context.moveTo(cellX, pixelsRow(1));
				context.lineTo(cellX, pixelsRow(tableDim.n + 1));
				var yStart = pixelsRow(0);
				var yEnd = pixelsRow(tableDim.n + 1);
				for(i = 0; i <= tableDim.m + 1; i++) {
					cellX = pixelsColumn(i);
					context.moveTo(cellX, yStart);
					context.lineTo(cellX, yEnd);
				}
				if (dataTable.lineWidth !== 0) context.stroke();
				else context.restore();
			}

			if (scaleLabel.display) {
				// Draw the scale label
				var scaleLabelX;
				var scaleLabelY;
				var rotation = 0;
				var halfLineHeight = parseLineHeight(scaleLabel) / 2;

				if (isHorizontal) {
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

				context.save();
				context.translate(scaleLabelX, scaleLabelY);
				context.rotate(rotation);
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				context.fillStyle = scaleLabelFontColor; // render in correct colour
				context.font = scaleLabelFont.font;
				context.fillText(scaleLabel.labelString, 0, 0);
				context.restore();
			}

			if (gridLines.drawBorder) {
				// Draw the line at the edge of the axis
				context.lineWidth = helpers.valueAtIndexOrDefault(gridLines.lineWidth, 0);
				context.strokeStyle = helpers.valueAtIndexOrDefault(gridLines.color, 0);
				var x1 = me.left;
				var x2 = me.right;
				var y1 = me.top;
				var y2 = me.bottom;

				var aliasPixel = helpers.aliasPixel(context.lineWidth);
				if (isHorizontal) {
					y1 = y2 = options.position === 'top' ? me.bottom : me.top;
					y1 += aliasPixel;
					y2 += aliasPixel;
				} else {
					x1 = x2 = options.position === 'left' ? me.right : me.left;
					x1 += aliasPixel;
					x2 += aliasPixel;
				}

				context.beginPath();
				context.moveTo(x1, y1);
				context.lineTo(x2, y2);
				context.stroke();
			}
		}
	});

	Chart.scaleService.registerScaleType('datatable', DatasetScale, defaultConfig);

};
