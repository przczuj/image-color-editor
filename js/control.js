window.addEventListener('DOMContentLoaded', function() {
    var imagePicker = document.getElementById('image-picker');

    imagePicker.onchange = function () {
        if (imagePicker.files && imagePicker.files[0]) {
            var fileReader = new FileReader();
            fileReader.onload = function () {
                var image = new Image();
                image.onload = function () {
                    image.style.display = 'none';
                    initEdit(image);
                };
                image.src = fileReader.result;
            };
            fileReader.readAsDataURL(imagePicker.files[0]);
        }
    };

    var SLIDER_SCALE = 100;
    var GREYSCALE_FILTER = 'greyscale';
    var HUE_FILTER = 'hue';
    var SATURATION_FILTER = 'saturation'

    var timers = [];

    function initEdit(image) {
        var imageCanvas = document.getElementById('image-canvas');
        imageCanvas.width = image.width;
        imageCanvas.height = image.height;
        var ctx = imageCanvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        var imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        var data = imageData.data;

        var originalImageCanvas = document.createElement('canvas');
        originalImageCanvas.width = image.width;
        originalImageCanvas.height = image.height;
        var originalCtx = originalImageCanvas.getContext('2d');
        originalCtx.drawImage(image, 0, 0);
        var originalImageData = originalCtx.getImageData(0, 0, originalImageCanvas.width, originalImageCanvas.height);
        var originalData = originalImageData.data;

        redrawImage();
        initTools(document.getElementById('tool-section'));

        function redrawImage() {
            timers.forEach(timer => { clearTimeout(timer); })
            timers = [];

            var chunkSize = 50000;
            for (var k = 0; k < data.length; k += 4 * chunkSize) {
                var chunkStart = k;
                var chunkEnd = Math.min(k + 4 * chunkSize, data.length);
                timers.push(
                    setTimeout(function (chunkStart, chunkEnd) {
                        for (var i = chunkStart; i < chunkEnd; i += 4) {
                            processPixel(i);
                        }
                        ctx.putImageData(imageData, 0, 0);
                    }, 0, chunkStart, chunkEnd)
                );
            }

            function processPixel(i) {
                data[i]     = originalData[i];
                data[i + 1] = originalData[i + 1];
                data[i + 2] = originalData[i + 2];

                var hsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
                var filters = readFilters();
                for (var j = 0; j < filters.length; j++) {
                    if (hsv[0] > filters[j].start && hsv[0] <= filters[j].end) {
                        if (filters[j].type === GREYSCALE_FILTER) {
                            var avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                            avg += filters[j].value * (filters[j].value < 0 ? avg : 255 - avg);

                            data[i]     = avg;
                            data[i + 1] = avg;
                            data[i + 2] = avg;
                        }
                        if (filters[j].type === HUE_FILTER) {
                            var newHsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
                            var hue =  newHsv[0] + filters[j].value;
                            while (hue < 0) hue += 1.0;
                            while (hue > 1) hue -= 1.0;
                            var rgb = hsvToRgb(hue, newHsv[1], newHsv[2]);

                            data[i]     = rgb[0];
                            data[i + 1] = rgb[1];
                            data[i + 2] = rgb[2];
                        }
                        if (filters[j].type === SATURATION_FILTER) {
                            var newHsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
                            var saturation = newHsv[1];
                            saturation += filters[j].value * (filters[j].value < 0 ? saturation : 1 - saturation);
                            var rgb = hsvToRgb(newHsv[0], saturation, newHsv[2]);

                            data[i]     = rgb[0];
                            data[i + 1] = rgb[1];
                            data[i + 2] = rgb[2];
                        }
                    }
                }
            }

            function readFilters() {
                var filters = [];
                var filtersSection = document.getElementById('filters-section');
                if (filtersSection) {
                    var filterContainers = filtersSection.children;
                    for (var i = 0; i < filterContainers.length; i++) {
                        var filterType = filterContainers[i].getElementsByClassName('filter-type-value')[0].value;
                        var rangeStart = filterContainers[i].getElementsByClassName('filter-start-value')[0].value;
                        var rangeEnd = filterContainers[i].getElementsByClassName('filter-end-value')[0].value;
                        var rangeValue = filterContainers[i].getElementsByClassName('filter-strength-value')[0].value;

                        filters.push({
                            type: filterType,
                            start: rangeStart / SLIDER_SCALE,
                            end: rangeEnd / SLIDER_SCALE,
                            value: rangeValue / SLIDER_SCALE
                        })
                    }
                }
                return filters;
            }
        }

        function initTools(toolSection) {
            toolSection.innerHTML = '';

            var filtersSection = document.createElement('div');
            filtersSection.id = 'filters-section';
            toolSection.append(filtersSection);

            var addFilterButton = document.createElement('button');
            addFilterButton.id = 'add-filter-button';
            addFilterButton.innerHTML = '+';
            addFilterButton.onclick = function () {
                filtersSection.append(newFilter());
                redrawImage(imageCanvas);
            };
            toolSection.append(addFilterButton);

            function newFilter() {
                var filterContainer = document.createElement('div');
                filterContainer.className = 'filter-container';

                filterContainer.append(
                    newInputContainer('filter-type', container => {
                        var filterTypeSelector = document.createElement('select');
                        filterTypeSelector.className = 'filter-type-value';
                        filterTypeSelector.append(newOption('Grayscale', GREYSCALE_FILTER));
                        filterTypeSelector.append(newOption('Hue', HUE_FILTER));
                        filterTypeSelector.append(newOption('Saturation', SATURATION_FILTER));
                        filterTypeSelector.onchange = function () { redrawImage(); }
                        container.append(filterTypeSelector);
                    })
                );

                filterContainer.append(
                    newInputContainer('filter-start', container => {
                        newSlider('Start', 'filter-start-value', 'hue-slider-background', 0, 1, 0.5)
                            .forEach(element => container.append(element));
                    })
                );

                filterContainer.append(
                    newInputContainer('filter-end', container => {
                        newSlider('End', 'filter-end-value', 'hue-slider-background', 0, 1, 1)
                            .forEach(element => container.append(element));
                    })
                );

                filterContainer.append(
                    newInputContainer('filter-start', container => {
                        newSlider('Strength', 'filter-strength-value', '', -1, 1, 0)
                            .forEach(element => container.append(element));
                    })
                );

                filterContainer.append(
                    newInputContainer('filter-remove', container => {
                        var removeButton = document.createElement('button');
                        removeButton.innerHTML = "remove";
                        removeButton.onclick = function removeFilter() {
                            filterContainer.parentNode.removeChild(filterContainer);
                            redrawImage();
                        };
                        container.append(removeButton);
                    })
                );

                return filterContainer;

                function newInputContainer(className, childrenFactory) {
                    var container = document.createElement('div');
                    container.className = 'filter-input-container ' + className;
                    childrenFactory(container);
                    return container;
                }

                function newOption(label, type) {
                    var option = document.createElement('option');
                    option.value = type;
                    option.innerHTML = label;
                    return option;
                }

                function newSlider(label, valueClass, sliderWrapperClass, min, max, value) {
                    var text = document.createElement('span');
                    text.innerHTML = label + ':';

                    var numeric = document.createElement('input');
                    numeric.className = 'filter-slider-numeric';
                    numeric.type = 'number';
                    numeric.step = 1 / SLIDER_SCALE;
                    numeric.oninput = function () { updateSlider(); redrawImage(); };

                    var sliderWrapper = document.createElement('div');
                    sliderWrapper.className = 'filter-slider-wrapper ' + sliderWrapperClass;

                    var slider = document.createElement('input');
                    slider.className = valueClass;
                    slider.type = 'range';
                    slider.min = min * SLIDER_SCALE;
                    slider.max = max * SLIDER_SCALE;
                    slider.value = value * SLIDER_SCALE;
                    slider.oninput = function () { updateNumeric(); redrawImage(); };
                    sliderWrapper.append(slider)

                    updateNumeric();
                    return [ text, numeric, sliderWrapper ];

                    function updateSlider() {
                        slider.value = numeric.value * SLIDER_SCALE;
                        updateNumeric();
                    }

                    function updateNumeric() {
                        numeric.value = slider.value / SLIDER_SCALE;
                    }
                }
            };
        }
    }
}, false);
