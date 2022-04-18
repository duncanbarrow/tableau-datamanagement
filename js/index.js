'use strict';

(function() {

    // vars to hold ref to the unregister event listener functions
    let unregisterSettingsEventListener = null;
    let unregisterFilterEventListener = null;
    let unregisterMarkSelectionListener = null;
    let unregisterParameterEventListener = [];

    var lkpArr = [];
    var lkpColArr = [];
    var colWArr = [];
    var lkpColIdxArr = [];
    var mainCols;
    var usernameCol;
    var tableRowCount;
    var gScriptUrl;
    var uniqueCols;
    var uniqueColIdxArr = [];
    var mainWorksheet;
    var newRows;
    var delRows;
    var readOnlyCols;
    var readOnlyColIdxArr = [];
    var notNullCols;
    var notNullColIdxArr = [];
    var excludeCols;
    var excludeColIdxArr = [];
    var filterCols;
    var filterColIdxArr = [];
    var childParam;
    var parentParam;

    $(function() {
        // add config option to call the config function
        tableau.extensions.initializeAsync({'configure': configure}).then(function() {
            loadExtension();

            // add settings listener
            unregisterSettingsEventListener = tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, (settingsEvent) => {
                loadExtension();
            });

            // add functionality to the buttons - making sure that they haven't already been set
            // NEW ROW
            if ($("#btn_newRow").attr("onClick") == undefined) {
                $("#btn_newRow").on("click", function() {
                    var emptyArr = [];
                    var rowNb = tableRowCount + 1;
                    addDataRow(emptyArr,rowNb);
                    tableRowCount += 1;
                });
            }
            

            // RESET
            if ($("#btn_reset").attr("onClick") == undefined) {
                $("#btn_reset").on("click", function() {
                    var retVal = confirm("Are you sure you want to reset? All changes will be lost");
                    if (retVal == true) {
                        loadExtension();
                    }
                });
            }

            // SUBMIT
            if ($("#btn_submit").attr("onClick") == undefined) {
                $("#btn_submit").on("click", function() {
                    submitData();
                });
            }

            // add ajax setup to show spinner while waiting for response
            $.ajaxSetup({
                beforeSend: function() {
                    $("#loader").removeClass("visually-hidden");
                },
                complete: function() {
                    $("#loader").addClass("visually-hidden");
                }
            });
        }, function() {console.log('Error while initializing: ' + err.toString());});
    });

    // main function to create the extension
    function loadExtension() {

        lkpArr = [];
        lkpColArr = [];
        colWArr = [];
        lkpColIdxArr = [];
        readOnlyColIdxArr = [];
        notNullColIdxArr = [];
        uniqueColIdxArr = [];
        excludeCols;
        excludeColIdxArr = [];
        filterCols;
        filterColIdxArr = [];

        // unregister event listeners for old worksheet, if exists
        if (unregisterFilterEventListener != null) {
            unregisterFilterEventListener();
        }
        if (unregisterMarkSelectionListener != null) {
            unregisterMarkSelectionListener();
        }
        if (unregisterParameterEventListener != []) {
            unregisterParameterEventListener = [];
        }

        // get settings and display
        // settings names:
        // mainWorksheet
        // lookupWorksheet
        // usernameCol
        // uniqueCols
        // gScriptUrl
        // lookupCols
        // newRows
        // delRows
        mainWorksheet = tableau.extensions.settings.get("mainWorksheet");
        var lookupWorksheet = tableau.extensions.settings.get("lookupWorksheet");
        usernameCol = tableau.extensions.settings.get("usernameCol");
        uniqueCols = tableau.extensions.settings.get("uniqueCols");
        gScriptUrl = tableau.extensions.settings.get("gScriptUrl");
        var lookupCols = tableau.extensions.settings.get("lookupCols");
        newRows = tableau.extensions.settings.get("newRows");
        delRows = tableau.extensions.settings.get("delRows");
        readOnlyCols = tableau.extensions.settings.get("readOnlyCols");
        notNullCols = tableau.extensions.settings.get("notNullCols");
        excludeCols = tableau.extensions.settings.get("excludeCols");
        filterCols = tableau.extensions.settings.get("filterCols");
        var tableAlign = tableau.extensions.settings.get("tableAlign");
        childParam = tableau.extensions.settings.get("childParam");
        parentParam = tableau.extensions.settings.get("parentParam");

        // hide New Row button if it is not enabled in the settings
        if (newRows != undefined && newRows == "False"){
            $("#btn_newRow").hide();
        } else if (newRows != undefined && newRows == "True") {
            $("#btn_newRow").show();
        }


        // set table alignment if defined (left align by default)
        if (tableAlign != undefined){
            if (tableAlign == "right"){
                $("#mainContainer").removeClass("mx-auto");
                $("#mainContainer").removeClass("ms-0");
                $("#mainContainer").addClass("me-0");

                $("#buttonRow").addClass("justify-content-end");
                $("#buttonRow").removeClass("justify-content-start");
                $("#buttonRow").removeClass("justify-content-center");

                $("#filterRow").addClass("justify-content-end");
                $("#filterRow").removeClass("justify-content-start");
                $("#filterRow").removeClass("justify-content-center");

                $("#dataTable").css("margin-left","auto");
                $("#dataTable").css("margin-right",0);
            } else if (tableAlign == "center") {
                $("#mainContainer").removeClass("me-0");
                $("#mainContainer").removeClass("ms-0");
                $("#mainContainer").addClass("mx-auto");

                $("#buttonRow").addClass("justify-content-center");
                $("#buttonRow").removeClass("justify-content-start");
                $("#buttonRow").removeClass("justify-content-end");

                $("#filterRow").addClass("justify-content-center");
                $("#filterRow").removeClass("justify-content-start");
                $("#filterRow").removeClass("justify-content-end");

                $("#dataTable").css("margin-left","auto");
                $("#dataTable").css("margin-right","auto");
            } else {
                $("#mainContainer").removeClass("me-0");
                $("#mainContainer").removeClass("mx-auto");
                $("#mainContainer").addClass("ms-0");

                $("#buttonRow").addClass("justify-content-start");
                $("#buttonRow").removeClass("justify-content-center");
                $("#buttonRow").removeClass("justify-content-end");

                $("#filterRow").addClass("justify-content-start");
                $("#filterRow").removeClass("justify-content-center");
                $("#filterRow").removeClass("justify-content-end");

                $("#dataTable").css("margin-left",0);
                $("#dataTable").css("margin-right","auto");
            }
        }

        

               

        if (mainWorksheet != undefined && lookupWorksheet != undefined && usernameCol != undefined && uniqueCols != undefined && gScriptUrl != undefined) {

            // get dashboard, main worksheet, lookup worksheet
            var dashboard = tableau.extensions.dashboardContent.dashboard;
            var mainWS = dashboard.worksheets.find(function (sheet) {
                return sheet.name === mainWorksheet;
            });
            var lkpWS = dashboard.worksheets.find(function (sheet) {
                return sheet.name === lookupWorksheet;
            });

            // if the parent parameter has been defined, then add a listener for that parameter and trigger a data refresh and extension reload
            if (parentParam != undefined && parentParam != "") {
                tableau.extensions.dashboardContent.dashboard.findParameterAsync(parentParam).then(function (p) {
                    var unregParamEventListener = p.addEventListener(tableau.TableauEventType.ParameterChanged, function(parameterEvent) {
                        // show loader spinner
                        $("#loader").removeClass("visually-hidden");
                        // first refresh data for both the lookup sheet
                        lkpWS.getDataSourcesAsync().then(function(lkDs) {
                            lkDs[0].refreshAsync().then(function() {
                                // then the main sheet
                                mainWS.getDataSourcesAsync().then(function(mDs) {
                                    mDs[0].refreshAsync().then(function() {
                                        // then reload the extension
                                        loadExtension();
                                        // hide the loader spinner
                                        $("#loader").addClass("visually-hidden");
                                    });
                                });
                            });
                        });
                    });
                    unregisterParameterEventListener.push(unregParamEventListener);
                });
            }

            // get lookup data first
            lkpWS.getSummaryDataAsync().then(function (lkpdata) {

                // find the indexes of the necessary columns "Lookup Name" and "Lookup Value"
                var lkpNameIdx = lkpdata.columns.find(column => column.fieldName === "Lookup Name").index;
                var lkpValueIdx = lkpdata.columns.find(column => column.fieldName === "Lookup Value").index;

                // see if there are parent-child relationships in the lookups
                var lkpParentNameCol = lkpdata.columns.find(column => column.fieldName === "Parent Lookup Name");
                var lkpParentValueCol = lkpdata.columns.find(column => column.fieldName === "Parent Lookup Value");
                var lkpParentNameIdx = -1;
                var lkpParentValueIdx = -1;
                if (lkpParentNameCol != undefined && lkpParentValueCol != undefined) {
                    lkpParentNameIdx = lkpParentNameCol.index;
                    lkpParentValueIdx = lkpParentValueCol.index;
                }

                // populate the array lkpArr with lookup lists
                // if there is no parent lookup the structure will be [LookupName,[Lookup Value 1,...,Lookup Value n]]
                // if there is a parent lookup, the structure will be [LookupName,[Lookup Value 1,...,Lookup Value n],Parent Lookup Name,[Parent Lkp Val1,...,Parent Lkp Valn]]
                // start with some temporary variables
                var currentLkpName = "";
                var currentLkpValues = [];
                var currentParentLkpName = "";
                var currentParentLkpValues = [];

                // loop over each row of the lookup data set
                lkpdata.data.forEach(function (lkpRow) {
                    // get the name of the lookup list (Lookup Name)
                    var tmplkpName = lkpRow[lkpNameIdx].value;
                    // check to see if this is the same as the previous row (which will be stored in the currentLkpName)
                    if (currentLkpName != tmplkpName) {
                        // then check that the sub-array of lookup values has some items (will be empty on the first row)
                        if (currentLkpValues.length > 0) {
                            // lastly check to see if the parent lookup and value have been defined
                            if (currentParentLkpName != "" && currentLkpValues.length > 0) {
                                // if they have then push the structure for the lookup with parent
                                lkpArr.push([currentLkpName,currentLkpValues,currentParentLkpName,currentParentLkpValues]);
                            } else {
                                // else push the structure for the lookup without parent
                                lkpArr.push([currentLkpName,currentLkpValues]);
                            }
                        }
                        // reset the variables after each change of lookup name
                        currentLkpName = tmplkpName;
                        currentLkpValues = [];
                        
                        currentParentLkpName = "";
                        currentParentLkpValues = [];
                    }
                    // for every row push the lookup values into the temp lookup value array
                    currentLkpValues.push(lkpRow[lkpValueIdx].value);
                    // check to see if the parent lookup has been defined and populate the variables if it has
                    if (lkpParentNameIdx > -1 && lkpParentValueIdx > -1) {
                        currentParentLkpName = lkpRow[lkpParentNameIdx].value;
                        currentParentLkpValues.push(lkpRow[lkpParentValueIdx].value);
                    }
                });

                // need to push the last array
                if (currentParentLkpName != "" && currentParentLkpValues.length > 0) {
                    lkpArr.push([currentLkpName,currentLkpValues,currentParentLkpName,currentParentLkpValues]);
                } else {
                    lkpArr.push([currentLkpName,currentLkpValues]);
                }
                

                // split settings value into an array for which columns have lookups
                
                if (lookupCols != undefined && lookupCols != "") {
                    lookupCols.split("||").forEach(function (kv) {
                        var colLkp = kv.split("|");
                        lkpColArr.push(colLkp);
                    });
                }

                // then get data from main worksheet
                mainWS.getSummaryDataAsync().then(function (sumdata) {
                    // get indexes of columns with lookups
                    mainCols = sumdata.columns;
                    if (lkpColArr.length > 0) {
                        lkpColArr.forEach(function (lkp) {
                            var lkpColIdx = mainCols.find(column => column.fieldName === lkp[0]).index;
                            lkpColIdxArr.push(lkpColIdx);
                        });
                    }

                    // get indexes of unique Columns into an array
                    var uniqueColArr = [];
                    if (uniqueCols != undefined && uniqueCols != ""){
                        uniqueColArr = uniqueCols.split("|");
                    }
                    if (uniqueColArr.length > 0){
                        uniqueColArr.forEach(function (pk) {
                            var pkColIdx = mainCols.find(column => column.fieldName === pk).index;
                            uniqueColIdxArr.push(pkColIdx);
                        });
                    }

                    // if there are any read only columns defined get them into an array
                    readOnlyColIdxArr = [];
                    var readOnlyColArr = [];
                    if (readOnlyCols != undefined && readOnlyCols != ""){
                        readOnlyColArr = readOnlyCols.split("|");
                    }
                    // then get indexes of those columns
                    if (readOnlyColArr.length > 0) {
                        readOnlyColArr.forEach(function (ro) {
                            var roColIdx = mainCols.find(column => column.fieldName === ro).index;
                            readOnlyColIdxArr.push(roColIdx);
                        });
                    }

                    // if there are any not null columns defined get them into an array
                    notNullColIdxArr = [];
                    var notNullColArr = [];
                    if (notNullCols != undefined && notNullCols != ""){
                        notNullColArr = notNullCols.split("|");
                    }
                    // then get indexes of those columns
                    if (notNullColArr.length > 0){
                        notNullColArr.forEach(function (nn) {
                            var nnColIdx = mainCols.find(column => column.fieldName === nn).index;
                            notNullColIdxArr.push(nnColIdx);
                        });
                    }

                    // if there are any excluded columns defined get them into an array
                    excludeColIdxArr = [];
                    var excludeColArr = [];
                    if (excludeCols != undefined && excludeCols != ""){
                        excludeColArr = excludeCols.split("|");
                    }
                    //then get the indexes of those columns
                    if (excludeColArr.length > 0){
                        excludeColArr.forEach(function (ex) {
                            var exColIdx = mainCols.find(column => column.fieldName === ex).index;
                            excludeColIdxArr.push(exColIdx);
                        });
                    }

                    // if there are any filter columns defined get them into an array
                    filterColIdxArr = [];
                    var filterColArr = [];
                    if (filterCols != undefined && filterCols != ""){
                        filterColArr = filterCols.split("|");
                    }
                    // then get the indexes of those columns
                    if (filterColArr.length > 0){
                        filterColArr.forEach(function (fl) {
                            var flColIdx = mainCols.find(column => column.fieldName === fl).index;
                            filterColIdxArr.push(flColIdx);
                        });
                    }

                    // add filters
                    $("#filterRow").text("");
                    $("#filterRow").append("<div class='col-auto'>&nbsp;</div>");
                    filterColArr.forEach(function (fl, i) {
                        var fltSpace = "me-2";
                        if (filterColArr.length == (i+1)) {
                            fltSpace = "me-0";
                        }

                        $("#filterRow").append("<div class='col-auto'><div class='dropdown'><button class='btn btn-outline-secondary dropdown-toggle checkbox-menu-all " + fltSpace + "' type='button' id='btn_fl_" + fl + "' data-bs-toggle='dropdown' data-bs-auto-close='outside' aria-haspopup='true' aria-expanded='true'>" + fl + "<span class='caret'></span></button><ul style='overflow-y: visible;' class='dropdown-menu checkbox-menu allow-focus' id='ul_fl_" + fl + "' aria-labelledby='btn_fl_" + fl + "'></ul></div></div>");

                        var flColIdx = filterColIdxArr[i];

                        var distFilterArr = [...new Set(sumdata.data.map(row => row[flColIdx].value))];
                        distFilterArr.sort();

                        distFilterArr.forEach(function(v) {
                            $("[id='ul_fl_" + fl + "']").append("<li><label class='dropdown-item'><input type='checkbox' checked>" + v + "</label></li>");
                        });

                        // add event listener for when it closes to filter the data as necessary
                        var filterDropdown = $("[id='btn_fl_" + fl + "']");
                        filterDropdown.on("hide.bs.dropdown", function() {
                            // get filter values checked and unchecked
                            var chkArr = [];
                            $(this).siblings("ul").find("input[type='checkbox']:not(.checkbox-menu-all-check):checked").parent('label').each(function () {
                                chkArr.push($(this).text());
                            });
                            var unchkArr = [];
                            $(this).siblings("ul").find("input[type='checkbox']:not(.checkbox-menu-all-check):not(:checked)").parent('label').each(function() {
                                unchkArr.push($(this).text());
                            });
                            
                            // set attr data-idm-filter to ethier 0 or 1 on the td element
                            chkArr.forEach(function (c) {
                                $("#dataTable").find("td[id$='_" + flColIdx + "']").children('[value="' + c + '"]').parent("td").attr("data-idm-filter","0");
                                $("#dataTable").find("td[id$='_" + flColIdx + "']").find('[value="' + c + '"]:selected').closest("td").attr("data-idm-filter","0");
                            });
                            unchkArr.forEach(function(u) {
                                $("#dataTable").find("td[id$='_" + flColIdx + "']").children('[value="' + u + '"]').parent("td").attr("data-idm-filter","1");
                                $("#dataTable").find("td[id$='_" + flColIdx + "']").find('[value="' + u + '"]:selected').closest("td").attr("data-idm-filter","1");
                            });

                            // then hide any row where there is at least 1 td with the attr data-idm-filter = 1
                            $("#dataTable").find("tr").each(function() {
                                if ($(this).find("td[data-idm-filter='1']").length > 0) {
                                    $(this).hide();
                                } else {
                                    $(this).show();
                                }
                            });
                        });

                    });
                    $("#filterRow").append("<div class='col-auto'>&nbsp;</div>");

                    // add functionality for "(All)" checkbox in filters
                    $(".checkbox-menu-all").on('click', function() {
                        var firstLabel = $(this).next("ul").children().first().children("label").text();
                        if (firstLabel != "(All)"){
                            $(this).next("ul").prepend("<li><label><input type='checkbox' class='checkbox-menu-all-check' checked>(All)</label></li>");
                        }
                    
                        $(this).next("ul").find("input[type='checkbox']:not(.checkbox-menu-all-check)").addClass("checkbox-menu-check");
                    
                        $(".checkbox-menu-all-check").on("change", function() {
                            var isAll = this.checked;
                            $(this).closest("ul").find("input[type='checkbox']").prop("checked",isAll);
                        });
                    
                        $(".checkbox-menu-check").on("change", function() {
                            // count all checkboxes in the list
                            var chkCount = ($(this).closest("ul").find("input[type='checkbox']").length - 1);
                            // count all that are checked
                            var chkCountChecked = $(this).closest("ul").find("input[type='checkbox']:not(.checkbox-menu-all-check):checked").length;
                            if (chkCount == chkCountChecked) {
                                $(this).closest("ul").find(".checkbox-menu-all-check").prop("checked",true);
                            } else {
                                $(this).closest("ul").find(".checkbox-menu-all-check").prop("checked",false);
                            }
                        });
                     });


                    // get the height of the visibile window and fix the viewed part of the table
                    // - 100 for the buttons
                    // - 175 if there are also filters
                    // if there are filters probably need to take them into account too
                    var windowH = $(document).height();
                    var heightAdj = -100;
                    if (filterColIdxArr.length > 0){
                        heightAdj = -175;
                    }

                    $("#tableContainer").css("height",(windowH + heightAdj));


                    
                    // clear table and create header row
                    $("#dataTable").text("");
                    $("#dataTable").append("<thead><tr id='dataTableHeaderRow'></tr></thead>");
                    mainCols.forEach(function (c) {
                        if (!excludeColIdxArr.includes(c.index)){
                            var colwidth = (c.fieldName.length / 2) + 2.5;
                        colWArr.push(colwidth);
                        $("#dataTableHeaderRow").append("<th id='th_" + c.fieldName + "' style='min-width:" + (colwidth-2) + "em; font-size:85%;'>" + c.fieldName + "</th>");
                        }
                    });

                    // if delete row is enabled then add a column to hold a delete row checkbox
                    if (delRows != undefined && delRows == "True") {
                        $("#dataTableHeaderRow").append("<th id='th_deleteChk'></th>");
                    }
                    
                    
                    // hide username column
                    var uNHeadId = "#th_" + usernameCol;
                    $(uNHeadId).hide();

                    // add tbody tag
                    $("#dataTable").append("<tbody></tbody>");

                    tableRowCount = 0;
                    
                    // loop over each row of data and put into table
                    sumdata.data.forEach(function (dr, i) {
                        addDataRow(dr, i);
                        tableRowCount += 1;
                    });
                });
            });
        }
        

    }

    // dr = row of data, i = row Id
    function addDataRow(dr, i) {
        var trId = "tr_" + i.toString();
        $("#dataTable > tbody").append("<tr id='" + trId + "'></tr>");

        var isNewRow = false;
        if (dr.length == 0) {isNewRow = true;}
        // if adding a new row then dr = [] so need to fill it will blank data for each column
        if (isNewRow) {
            mainCols.forEach(function(c) {
                dr.push({value:""});
            });
        }

        

        
        // loop over the columns using the data type to restric the input
        dr.forEach(function(dc, j) {
            if (!excludeColIdxArr.includes(j)) {
                var tdId = "td_" + i.toString() + "_" + j.toString();
                $("[id='" + trId + "']").append("<td id='" + tdId + "'></td>");
                // highlight it blue if it's a new row
                if (isNewRow) {
                    $("#" + tdId).addClass("table-primary");
                }
                
                var valLen = 0;
                if (!isNewRow) { valLen = (dc.value.length / 2) + 2.5;}
                var colW = colWArr[j];
                if (colW < valLen) {
                    colW = valLen;
                    colWArr[j] = colW;
                    // update previous widths
                    $("[id^='td_'][id$='_" + j.toString() + "']").children("input").css("width",colW + "em");
                }

                var colDataType = mainCols[j].dataType;

                var cellValue = dc.value;

                // if the cell value is null then replace with empty string
                if (cellValue == "%null%") {
                    cellValue = "";
                }

                // first check if it's a lookup column
                if (lkpColIdxArr.includes(j)) {
                    var colName = mainCols[j].fieldName;
                    var colLkpListName = "";
                    // loop through the list of column lookup settings and find the name of the lookup list
                    lkpColArr.forEach(function (a) {
                        if (a[0] == colName) {
                            colLkpListName = a[1];
                        }
                    });
                    // then get the list of values for that list
                    // also check if there is a parent lookup, if so, get the name and values that correspond
                    var colSelArr = [];
                    var parentLkpName = "";
                    var parentLkpValArr = [];
                    if (colLkpListName != "") {
                        lkpArr.forEach(function (a) {
                            if (a[0] == colLkpListName) {
                                colSelArr = a[1];
                                // checking for parent
                                if (a.length == 4) {
                                    parentLkpName = a[2];
                                    parentLkpValArr = a[3];
                                }
                            }
                        });
                    }


                    // get the length of the longest string in the lookup array and adjust the colW to that
                    var longestLkpItem = colSelArr.reduce((a, b) => a.length > b.length ? a : b);
                    var longest = (longestLkpItem.length / 2) + 2.5;
                    if (colW < longest) {
                        colW = longest;
                        colWArr[j] = colW;
                    }

                    var foundExistingVal = false;

                    // add the values as select options making sure that the current value is selected
                    var selectedVal = cellValue;
                    // also check if there's any old values that are longer than in the current list and adjust to that width
                    if (!isNewRow) {
                        var selectedValLen = (selectedVal.length / 2) + 2.5;
                        if (colW < selectedValLen) {
                            colW = selectedValLen;
                            colWArr[j] = colW;
                        }
                    }

                    // update any existing rows to the width
                    $("[id^='sel_'][id$='_" + j.toString() + "']").css("width", (colW + 1) + "em");


                    $("[id='" + tdId + "']").append("<select id='sel_" + tdId + "' style='width:" + (colW + 1) + "em; font-size:75%;' class='form-select form-select-sm' data-lookupname='" + colLkpListName + "'></select>");
                    // add an extra attribute data-lookupParentName if there is a parent defined
                    if (parentLkpName != "") {
                        $("[id='sel_" + tdId + "']").attr("data-lookupparentname",parentLkpName);
                    }
                    // if it's a new row then need to add a blank value to the select that will be removed after the user has selected a value
                    if (isNewRow || cellValue == "") {
                        $("[id='sel_" + tdId + "']").append("<option id='blkopt_" + tdId + "' value='' selected></option>");
                        $("[id='sel_" + tdId + "']").on("change", function() {
                            $("[id='blkopt_" + tdId + "']").hide();
                        });
                        foundExistingVal = true;
                    }
                    
                    colSelArr.sort().forEach(function(lv,w) {
                        if (lv == selectedVal) {
                            // if parent defined then add the attribute data-lookupParentValue
                            if (parentLkpName != "" && parentLkpValArr.length > w) {
                                $("[id='sel_" + tdId + "']").append("<option value='" + lv.replace(/'/g, "&#39;") + "' data-lookupparentvalue='" + parentLkpValArr[w].replace(/'/g, "&#39;") + "' selected>" + lv + "</option>");
                            } else {
                                $("[id='sel_" + tdId + "']").append("<option value='" + lv.replace(/'/g, "&#39;") + "' selected>" + lv + "</option>");
                            }
                            
                            foundExistingVal = true;
                        } else {
                            // if parent defined then add the attribute data-lookupParentValue
                            if (parentLkpName != "" && parentLkpValArr.length > w) {
                                $("[id='sel_" + tdId + "']").append("<option value='" + lv.replace(/'/g, "&#39;") + "' data-lookupparentvalue='" + parentLkpValArr[w].replace(/'/g, "&#39;") + "'>" + lv + "</option>");
                            } else {
                                $("[id='sel_" + tdId + "']").append("<option value='" + lv.replace(/'/g, "&#39;") + "'>" + lv + "</option>");
                            }
                            
                        }
                    });

                    // if it's not a new row and it has an existing value that is no longer there in the lookups, then add it as a special value to this one select list
                    if (!foundExistingVal && cellValue != "") {
                        $("[id='sel_" + tdId + "']").append("<option value='" + selectedVal.replace(/'/g, "&#39;") + "' selected>" + selectedVal + "</option>");
                    }

                    // if it has a parent lookup, then first check to see if the parent has a value
                    if (parentLkpName != "") {
                        var $currSel = $("[id='sel_" + tdId + "']");
                        var $parentSel = $("[id^=sel_td_" + i.toString() + "_][data-lookupname='" + parentLkpName + "']");
                        var currParentVal = $parentSel.val();
                        //$currSel.closest("[data-lookupname='" + parentLkpName + "']").val();
                        // if the value is defined and not blank
                        if (currParentVal != undefined && currParentVal != "") {
                            // first show all the options
                            $currSel.children().show();
                            // then hide the unnecessary ones by a filter the list to the currently unselected options which don't match the parent selected value
                            $currSel.children("[data-lookupparentvalue!='" + currParentVal + "']").filter(":not(:selected)").hide();
                        } else {
                            // if no current value in the parent then hide all options excpet the blank one until they choose a parent value
                            $currSel.children().filter(":not(:selected)").hide();
                        }

                        // then add an on change event to the parent 
                        $parentSel.on("change",function() {
                            var newParentVal = $(this).val();
                            if (newParentVal != undefined && newParentVal != "") {
                                // first show all the options
                                $currSel.children().show();
                                // make sure the blank value is selected
                                $currSel.val("");
                                // then hide the unnecessary ones by a filter the list to the currently unselected options which don't match the parent selected value
                                $currSel.children("[data-lookupparentvalue!='" + newParentVal + "']").filter(":not(:selected)").hide();
                            }
                        });
                    }
                } else
                // datatype = string
                if (colDataType == "string") {
                    //<input type="text" value="testing" class="form-control">
                    
                    $("[id='" + tdId + "']").append("<input type='text' style='width:" + colW + "em; font-size:75%;' class='form-control form-control-sm' value='" + dc.value + "'>");
                    // and hide it if it's the username column
                    if (mainCols[j].fieldName == usernameCol) {
                        $("[id='" + tdId + "']").hide();
                    }
                } else 
                // datatype = integer || int
                if (colDataType == "integer" || colDataType == "int") {
                    $("[id='" + tdId + "']").append("<input type='number' style='width:" + colW + "em; font-size:75%;' class='form-control form-control-sm' value='" + dc.value + "'>");
                    $("[id='" + tdId + "']").children().on("input", function() {
                        if ($(this).val() != "") {
                            $(this).val(Math.round($(this).val()));
                        }
                    });
                } 
                else 
                // datatype = float
                if (colDataType == "float") {
                    $("[id='" + tdId + "']").append("<input type='number' style='width:" + colW + "em; font-size:75%;' class='form-control form-control-sm' value='" + dc.value + "'>");
                }
                else
                // datype = date
                if (colDataType == "date") {
                    $("[id='" + tdId + "']").append("<input type='text' style='width:7em; font-size:75%;' class='form-control form-control-sm' value='" + dc.value + "'>");
                    var dtOptions = {
                        format: 'yyyy-mm-dd',
                        todayHighlight: true,
                        autoclose: true,
                    };
                    $("[id='" + tdId + "']").children().datepicker(dtOptions);
                }
                else
                // datatype = boolean || bool
                if (colDataType == "boolean" || colDataType == "bool") {
                    $("[id='" + tdId + "']").css("text-align","center");
                    $("[id='" + tdId + "']").css("width",colW + "em");
                    $("[id='" + tdId + "']").append("<input class='form-check-input' type='checkbox' >");
                    if (dc.value == true) {
                        $("[id='" + tdId + "']").children().prop("checked",true);
                    }                
                }

                // if the column index (j) is in the unique column index array OR the not null column index array
                // then add a new attribute data-notnull = true, else remove this attribute
                if (uniqueColIdxArr.includes(j) || notNullColIdxArr.includes(j)){
                    $("[id='" + tdId + "']").attr("data-notnull",true);
                } else {
                    $("[id='" + tdId + "']").removeAttr("data-notnull");
                }

                // if the column index (j) is in the read only column index array then make sure it's disabled as an input
                if (readOnlyColIdxArr.includes(j)){
                    $("[id='" + tdId + "']").find("input, select").prop("disabled",true);
                } else {
                    $("[id='" + tdId + "']").find("input, select").prop("disabled",false);
                }
            }
            


        });
        // if delete rows is enabled then add button to remove row
        if (delRows != undefined && delRows == "True") {
            var trDelId = "td_" + i.toString() + "_delRow";
            var trDelBtnId = trDelId + "_btn";
            $("[id='" + trId + "']").append("<td id='" + trDelId + "'><button style='width:2.5em' class='btn btn-danger btn-sm' id='" + trDelBtnId + "'>×</button></td>");
            // if it's a new row the delete button removes the row entirely from the table so it never even gets submitted
            if (isNewRow) {
                $("[id='" + trDelId + "']").addClass("table-primary");
                $("[id='" + trDelBtnId + "']").on("click", function() {
                    var $dRow = $(this).parent().parent();
                    $dRow.remove();
                });
            } else {
                // but if it was already there, the delete button marks the row to be deleted
                $("[id='" + trDelBtnId + "']").on("click", function() {
                    var $dRow = $(this).parent().parent();
                    $dRow.toggleClass("text-decoration-line-through");
                    $dRow.toggleClass("table-danger");
                    if ($dRow.find("input, select").prop("disabled")) {
                        $dRow.find("input, select").prop("disabled",false);
                    } else {
                        $dRow.find("input, select").prop("disabled",true);
                    }
                });
            }
        }
        
    }

    // submit data
    function submitData() {

        // clear the red border if exists against previous duplicate rows
        $("tr").children().children().removeClass("border");
        $("tr").children().children().removeClass("border-danger");

        // clear any red background from validation errors if exists
        $("tr").children().children().removeClass("bg-danger");
        $("tr").children().children().removeClass("text-white");

        // first check all cells with the attribute data-notnull = true have a value
        var notnullCount = 0;
        $("[data-notnull=true]").find("input, select").each(function() {
            // checkboxes always have a default value (false) so no need to check them
            if (!$(this).is(":checkbox")){
                var cellValue = $(this).val();
                // the the cell doesn't have a value then put background red and text white
                if (cellValue == undefined || cellValue == ""){
                    notnullCount ++;
                    $(this).addClass("bg-danger");
                    $(this).addClass("text-white");

                    // also add a function on change to remove this formatting when a value has been put in
                    $(this).on("change", function() {
                        $(this).removeClass("bg-danger");
                        $(this).removeClass("text-white");
                    });
                }
            }
        });
        if (notnullCount > 0){
            alert("Missing Values\nEmpty cells that require values have been highlighted");
            return;
        }


        var tblRows = [];
        var userName = ""; //usernameCol
        var userNameIndex = $("#dataTable thead th").filter(function() {
            return $(this).text() == usernameCol;
        }).index();

        var $headers = $("#dataTable thead th");
        var $rows = $("#dataTable tbody tr").each(function(index) {
            var $cells = $(this).find("td");
            var trId = $(this).prop("id");
            tblRows[index] = {};
            tblRows[index]["__rowId"] = trId;
            
            $cells.each(function(cellIndex) {
                var celValue;
                if ($(this).children().is(":checkbox")) {
                    if ($(this).children().prop("checked")) {
                        celValue = true;
                    } else {
                        celValue = false;
                    }
                } else if ($(this).children().is("select") || $(this).children().is("input")) {
                    celValue = $(this).children().val();
                }

                if (cellIndex == userNameIndex) {
                    if (userName == "") {
                        userName = celValue;
                    }
                } else {
                    tblRows[index][$($headers[cellIndex]).html()] = celValue;
                }

                
                
            });

            // add extra column to show if row is being deleted
            if ($(this).hasClass("text-decoration-line-through")) {
                tblRows[index]["__isDeleted"] = true;
            } else {
                tblRows[index]["__isDeleted"] = false;
            }
        });

        var tblObj = {};
        tblObj.username = userName;
        tblObj.uniqueColumns = uniqueCols.split("|");
        tblObj.tblrows = tblRows;
        console.log(JSON.stringify(tblObj));

        

        $.post(gScriptUrl,JSON.stringify(tblObj), function(data) {submitResponse(data);});
    };

    function submitResponse(data) {
        try {
            var jsonData = JSON.parse(data);
            if (jsonData.code == "401") {
                // not authorized
                alert("Not Authorized\n" + jsonData.message);
            } else if (jsonData.code == "406") {
                // duplicates
                alert("Duplicates Found!\nThe duplicate rows have been highlighted");
                // add a red border around all duplicate rows
                jsonData.message.forEach(function(dup) {
                    $("#" + dup).children().children().addClass("border");
                    $("#" + dup).children().children().addClass("border-danger");
                });
            } else if (jsonData.code == "422") {
                // data validation error
                alert(jsonData.title);
                // add a red border around the cells that have validation errors
                jsonData.message.forEach(function(val) {
                    // get the rowId
                    var rId = val[0];
                    // get the column name with the error
                    var col = val[1];

                    // get the index of that columm
                    var colIdx = mainCols.find(column => column.fieldName == col).index;

                    // construct the id of the td element
                    var errTdId = rId.replace("tr","td") + "_" + colIdx;

                    // highlight the cell
                    $("#" + errTdId).children().addClass("bg-danger");
                    $("#" + errTdId).children().addClass("text-white");

                });
            } else if (jsonData.code == "500") {
                //error on deletion or merge
                alert("Error\nDelete: " + jsonData.delete_message + "\nMerge: " + jsonData.merge_message);
            } else if (jsonData.code == "200") {
                // success!
                alert("Data Submitted Successfully");
                $("#loader").removeClass("visually-hidden");
                // refresh the data on the worksheets then reload the table to reflect the updated data
                var dashboard = tableau.extensions.dashboardContent.dashboard;
                var mainWS = dashboard.worksheets.find(function (sheet) {
                    return sheet.name === mainWorksheet;
                });
                mainWS.getDataSourcesAsync().then(ds => {
                    ds[0].refreshAsync().then(function() {

                        // if the child parameter has been set then change the value of this parameter to trigger the child extension to refresh
                        if (childParam != undefined && childParam != ""){
                            dashboard.findParameterAsync(childParam).then(function(p) {
                                // parameter should be bool, get value, then change to the other value false/true
                                var cParamVal = p.currentValue.value;
                                if (cParamVal == "true") {
                                    p.changeValueAsync(false);
                                } else {
                                    p.changeValueAsync(true);
                                }
                            });
                        }

                        loadExtension();
                        $("#loader").addClass("visually-hidden");
                    });
                });
            }
        }
        catch (e) {
            alert(data);
        }
        
    }

    // config button
    function configure() {
        const popupUrl = `${window.location.href.replace(/[^/]*$/, '')}/dialog.html`;

        let input = "";

        tableau.extensions.ui.displayDialogAsync(popupUrl, input, {height: 540, width: 950}).then((closePayload) => {

        }).catch((error) => {
            // one expected error condition is when the popup is closed by the user (clicking on the 'x' in the top right)
            switch (error.errorCode) {
                case tableau.ErrorCodes.DialogClosedByUser:
                    console.log("Dialog was closed by user");
                    break;
                default:
                    console.log(error.message);
            }
        });
    }
})();