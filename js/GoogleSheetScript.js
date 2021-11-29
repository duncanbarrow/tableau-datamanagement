// TO DO
// Create a google sheet with 3 tabs:
// 1) to hold the data you want to be able to edit from tableau (called whatever you want)
// 2) to hold lookup drop down lists to be used in tableau (must have 2 columns "Lookup Name", "Lookup Value")
// 3) to hold security, a list of the usernames from tableau that have access to edit the data

// ssId = the alphanumerica ID of the google sheet
var ssId = "";
// securityTab = the name of the sheet that will be used for security within the sheet
var securityTab = "";
// mainTab = the name of the main data tab which holds the data that will be edited
var mainTab = "";

function doPost(e) {

  var postData = e.postData;
  var cont = JSON.parse(postData.contents);

  var ss = SpreadsheetApp.openById(ssId);

  // first split into different objects: username, unique columns, data_deleted, data

  var username = cont.username;
  var uniqueColumns = cont.uniqueColumns;
  var data_deleted = cont.tblrows.filter(row => row.__isDeleted == true);
  var data = cont.tblrows.filter(row => row.__isDeleted == false);


  // first check permissions
  
  var hasPermission = securityCheck(username);

  // if user has permissions to edit then continue
  if (hasPermission) {

    // check non-deleted data rows are unique
    var dupRows = findDuplicates(data, uniqueColumns);
    if (dupRows.length > 0) {
      // duplicates were found
      var hasDups = {};
      hasDups.code = 406;
      hasDups.message = dupRows;

      return ContentService.createTextOutput(JSON.stringify(hasDups));
    }
    else {

      // user has permissions and there are no duplicates

      // first delete any rows as necessary
      var rowsDeleted = deleteRows(data_deleted, uniqueColumns);

      // then merge the rest of the data
      var rowsMerged = mergeRows(data, uniqueColumns);

      // if both successful then return success to the extension
      if (rowsDeleted == "success" && rowsMerged == "success") {
        var suc = {};
        suc.code = 200;
        suc.message = "Data Submitted Successfully";

        return ContentService.createTextOutput(JSON.stringify(suc));
      } else {
        // if there was an error return the error message(s)
        var err = {};
        err.code = 500;
        err.delete_message = JSON.stringify(rowsDeleted);
        err.merge_message = JSON.stringify(rowsMerged);

        return ContentService.createTextOutput(JSON.stringify(err));
      }
    }

    
  } else {

    // if user doesn't have permission then return a message saying this
    var noPerm = {};
    noPerm.code = 401;
    noPerm.message = username + " does not have permission to edit this data";

    //return ContentService.createTextOutput(JSON.stringify(e)).setMimeType(ContentService.MimeType.JSON);
    return ContentService.createTextOutput(JSON.stringify(noPerm));
  }
}

function securityCheck(username) {
  var ss = SpreadsheetApp.openById(ssId);
  var securitySheet = ss.getSheetByName(securityTab);
  var securityRange = securitySheet.getDataRange();
  var securityVals = securityRange.getValues();

  var hasPermission = securityVals.some(row => row.includes(username));

  return hasPermission;
}

function findDuplicates(data,uniqueColumns) {

  // first reduce the unique column values (as a | delimited value) with a count of entries with that combination
  // similar to a COUNT(*) GROUP BY [list of unique columns]
  var counts = data.reduce(function(p, c) {
    var uniqueValArr = [];
    uniqueColumns.forEach(function (uc) {
      uniqueValArr.push(c[uc]);
    });
    var pk = uniqueValArr.join("|");
    if (!p.hasOwnProperty(pk)) {
      p[pk] = 0;
    }
    p[pk]++;
    return p;
  }, {});

  // then get an array from this counts object where the value > 1
  var dupKeys = Object.keys(counts).filter(pk => counts[pk] > 1);

  // finally get a new array of the rows that are duplicates
  var dupRows = [];
  data.forEach(function (row) {
    var uniqueValArr = [];
    uniqueColumns.forEach(function (uc) {
      uniqueValArr.push(row[uc]);
    });
    var pk = uniqueValArr.join("|");

    if (dupKeys.includes(pk)) {
      dupRows.push(row.__rowId);
    }

  });

  return dupRows;
}

function deleteRows(data, uniqueColumns) {
  try {
    // create a new array of PKs to be deleted - concatenated by |
    var delPKArr = [];
    data.forEach(function(row) {
      var delPK = [];
      uniqueColumns.forEach(function(uc) {
        delPK.push(row[uc]);
      })
      delPKArr.push(delPK.join("|"));
    });

    var ss = SpreadsheetApp.openById(ssId);
    var mainSheet = ss.getSheetByName(mainTab);
    var mainRange = mainSheet.getDataRange();
    var mainVals = mainRange.getValues();

    // find the index of the unique columns by matching the name against the first row
    var uniqueIdxs = {};
    mainVals[0].forEach(function(colHeader, i) {
      if (uniqueColumns.includes(colHeader)) {
        uniqueIdxs[colHeader] = i;
      }
    });

    var mainDelIdxs = [];
    // loop through the rows and put the row index into an array if it matches a record to be deleted
    mainVals.forEach(function(row, i) {
      var rowPK = [];
      for (const [key, value] of Object.entries(uniqueIdxs)) {
        rowPK.push(row[value]);
      }
      var rowPKc = rowPK.join("|");
      if (delPKArr.includes(rowPKc)) {
        mainDelIdxs.push(i);
      }

      
    });

    // start at the bottom and work up when deleting because the indexes get renumbered and will delete the wrong rows otherwise
    mainDelIdxs.reverse().forEach(function(rowIdx) {
      // rows start at 1, the indexes are 0 based so make sure to + 1
      mainSheet.deleteRow(rowIdx + 1);
    });

    return "success";
  }
  catch(e) {
    return e;
  }

}

function mergeRows(data, uniqueColumns) {

  try {

    // get existing data from spreadsheet main tab
    var ss = SpreadsheetApp.openById(ssId);
    var mainSheet = ss.getSheetByName(mainTab);
    var mainRange = mainSheet.getDataRange();
    var mainVals = mainRange.getValues();

    // put headers into a new array
    var headers = mainVals[0];

    // remove header from mainVals
    mainVals.shift();
    
    var colMap = {};
    // use first row of data to get keys and match them against column headers to give a map from key -> column index
    for (const [key, value] of Object.entries(data[0])) {
      // ignore any key starting with double underscore
      if (!key.startsWith("__")) {
        var colIndex = headers.indexOf(key);
        colMap[key] = colIndex;
      }
    }


    // turn indexes into a new object with the key being the PK of the row
    var rowVals = {};
    mainVals.forEach(function(row, i) {
      // get pk
      var rowPKArr = [];
      uniqueColumns.forEach(function(pk) {
        var pkIdx = colMap[pk];
        rowPKArr.push(row[pkIdx].toUpperCase());
      });
      var rowPK = rowPKArr.join("|");

      rowVals[rowPK] = i;
    });

    var dataPKs = [];
    // loop over each row of data
    data.forEach(function(dataRow) {
      // get the PK of that row as a string concat with |
      var pkArr = [];
      uniqueColumns.forEach(function(pk) {
        pkArr.push(dataRow[pk].toUpperCase());
      });
      var dataRowPK = pkArr.join("|");

      dataPKs.push(dataRowPK);

      // try to find the index of this PK in the rowVals
      var dataRowIdx = rowVals[dataRowPK];
      if (dataRowIdx != undefined) {
        // update the row looping over each key value pair, finding the column index and updating it in the spread sheet
        for (const [key, value] of Object.entries(dataRow)) {
          // ignore any key starting with a double underscore
          if (!key.startsWith("__")) {
            var colIdx = colMap[key];

            var cell = mainSheet.getRange(dataRowIdx + 2, colIdx + 1);
            cell.setValue(value);
          }
        }
      }
      else {
        // insert a new row if the PK wasn't found
        // first get the last existing row index
        var lastExistRow = mainSheet.getLastRow();

        // loop over the key value pairs
        for (const [key, value] of Object.entries(dataRow)) {
          // ignore any key starting with a double underscore
          if (!key.startsWith("__")) {
            var colIdx = colMap[key];

            var cell = mainSheet.getRange(lastExistRow + 1, colIdx + 1);
            cell.setValue(value);
          }
        }
      }

    });

    // lastly check for any rows that still exist but weren't pushed in the data
    // these should be deleted as it is probably from when a PK changed
    // so the old one doesn't exist anymore
    var delIdxs = [];
    for (const [key,value] of Object.entries(rowVals)) {
      if (!dataPKs.includes(key)) {
        delIdxs.push(value);
      }
    }
    if (delIdxs.length > 0) {
      // sort the row indexes descending so as to delete from the bottom up
      delIdxs.sort(function(a, b){return b-a}).forEach(function(rowIdx) {
        // rows start at 1, the indexes are 0 based, but we already removed a row for the headers so make sure to + 2
        mainSheet.deleteRow(rowIdx + 2);
      });
    }

    return "success";
  }
  catch (e) {
    return e;
  }

}

