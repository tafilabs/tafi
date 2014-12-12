'use strict';

var _        = require('underscore')
  , async    = require('async')
  , Entities = require('html-entities').AllHtmlEntities
  , mysql    = require('mysql');



// ========== Database utility functions ==========

//
// IMPORTANT NOTE:
//   Many functions here take an 'sConnectionType' string parameter. This controls which connection
//   information (configuration settings) to use when connecting to the database.
//   The standard values are:
//
//   - 'ADMIN' - Should only be used for functions invoked from within Administration apps
//
//   - 'RW'    - Should be used for functions performing SELECTs, INSERTs, UPDATEs, or DELETEs
//               that are performed through the normal execution of an end-user's visit to an app
//               This connection will have "just enough" privileges to support the functions
//               that use it but no more (not like ADMIN above). Note that this means that if/when
//               a new table is added which requires DML access from an end-user-facing app,
//               the appropriate permissions must be given to the seeitrw user (grant insert on table...)
//
//   - 'RO'    - Should be used for functions only performing SELECTs (no DML) on tables that
//               don't change frequently and which are replicated across datacenters
//               This allows the fastest possible response (since it will come from a geographically
//               "local" database)
//
//   Note that optionally, one of these values can be preceded by 'MULTI_', which will allow
//   multiple statements to be used on the connection created. This is not the normal behavior
//   since not allowing multiple satements is safer (from SQL injection attacks).
//



var MYSQL_DEBUG_LEVEL, UTIL_DB_DEBUG_LEVEL, config, mySqlDebugLevel, utilDbDebugLevel;



// MySQL debugging levels -- see https://www.npmjs.org/package/mysql
MYSQL_DEBUG_LEVEL = {
  OFF              : false,
  QUERIES          : [ 'ComQueryPacket' ],
  ROWS             : [ 'RowDataPacket' ],
  QUERIES_AND_ROWS : [ 'ComQueryPacket', 'RowDataPacket ' ],
  ON               : true
};

// utilDb debugging levels
UTIL_DB_DEBUG_LEVEL = {
  OFF : false,
  ON  : true
};



var setMySqlDebugLevel = function(level) {
  mySqlDebugLevel = MYSQL_DEBUG_LEVEL[level];
};



var setUtilDbDebugLevel = function(level) {
  utilDbDebugLevel = UTIL_DB_DEBUG_LEVEL[level];
};



// NOTE: Expectation is that config contains the keys: mysql_admin, mysql_rw, and mysql_ro,
//       each of which contains the keys: host, port, username, password, and database
//       As well, config can contain the keys: mySqlDebugLevel (which should be one of the
//       values (keys) within MYSQL_DEBUG_LEVEL, and utilDbDebugLevel (which should be one of the
//       values (keys) within UTIL_DB_DEBUG_LEVEL)
var init = function(pConfig) {
  config = pConfig;
  setMySqlDebugLevel(config.mySqlDebugLevel || MYSQL_DEBUG_LEVEL.OFF);
  setUtilDbDebugLevel(config.utilDbDebugLevel || UTIL_DB_DEBUG_LEVEL.OFF);
};



// Create a MySQL connection using the appropriate configuration keys in the appropriate config file
// Note: Naming convention: If sConnectionType starts with 'MULTI_', then the connection will be set up
//       allow multiple statements. This is normally turned off (safer from SQL injection attacks)             
var createConnection = function(sConnectionType) {
  var bAllowMultipleStatements, configKey, options, connection;
  
  if ( ! config ) { return null; }

  bAllowMultipleStatements = false;
  if ( sConnectionType.indexOf('MULTI_') === 0 ) {
    sConnectionType = sConnectionType.substring('MULTI_'.length);
    bAllowMultipleStatements = true;
  }
  
  if ( sConnectionType === 'ADMIN' ) {
    configKey = 'mysql_admin';
  } else if ( sConnectionType === 'RW' ) {
    configKey = 'mysql_rw';
  } else {
    configKey = 'mysql_ro';  // Seems safe to make the read-only connection the default if a bad sConnectionType value is given
  }

  options = {
    host     : config[configKey].host,
    port     : config[configKey].port,
    user     : config[configKey].username,
    password : config[configKey].password,
    database : config[configKey].database,
  };
  options.debug = mySqlDebugLevel;
  options.multipleStatements = bAllowMultipleStatements;

  connection = mysql.createConnection(options);
  return connection;
};



var getDatabaseName = function(sConnectionType) {
  if ( ! config ) { return null; }

  if ( sConnectionType === 'ADMIN' ) {
    return config.mysql_admin.database;
  } else if ( sConnectionType === 'RW' ) {
    return config.mysql_rw.database;
  } else {
    return config.mysql_ro.database;  // Seems safe to make the read-only connection the default if a bad sConnectionType value is given
  }
};



// Perform "select count(*) from <tableName>"
var getCount = function(sConnectionType, tableName, callback) {
  var connection;

  if ( ! config ) { return null; }

  connection = createConnection(sConnectionType);
  connection.connect();
  connection.query('select count(*) as count from ' + tableName, function(err, result) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, result[0].count);
    return;
  });
  connection.end();
};



// Perform arbitrary SQL that uses ? placeholders and return results using given connection
// Returns (via callback parameter) the results of the SQL statement (e.g., result set for a query)
var doParameterizedSql = function(sConnectionType, sql, vals, callback) {
  var connection;

  if ( ! config ) { return null; }

  if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
    console.log('db.js::doParameterizedSql: SQL: ' + sql + ' Values: ' + vals);
  }
  connection = createConnection(sConnectionType);
  connection.connect();
  connection.query(sql, vals, function(err, results) {
    connection.end();
    if (err) {
      if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
        console.log('db.js::doParameterizedSql: ERROR: ');
        console.log(err);
      }
      callback(err);
      return;
    }
    callback(null, results);
    return;
  });
};



// Perform arbitrary SQL that uses ? placeholders and return results using given connection
// Returns (via callback parameter) the single (first) row within the result set of the query as a JS object
// NOTE: No enforcement is done to ensure that the query given actually returns exactly one row
var doParameterizedSqlSingle = function(sConnectionType, sql, vals, callback) {
  var connection;

  if ( ! config ) { return null; }

  if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
    console.log('db.js::doParameterizedSqlSingle: SQL: ' + sql + ' Values: ' + vals);
  }
  connection = createConnection(sConnectionType);
  connection.connect();
  connection.query(sql, vals, function(err, results) {
    connection.end();
    if (err) {
      if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
        console.log('db.js::doParameterizedSqlSingle: ERROR: ');
        console.log(err);
      }
      callback(err);
      return;
    }
    if ( results && results.length >= 1 ) {
      callback(null, results[0]);
      return;
    } else {
      callback(null, null);
      return;
    }
  });
};



// Perform arbitrary insert that uses ? placeholders and return generated id using given connection
// Returns (via callback parameter) the auto-generated id value of the inserted row
var doParameterizedInsert = function(sConnectionType, sql, vals, callback) {
  var connection;

  if ( ! config ) { return null; }

  if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
    console.log('db.js::doParameterizedInsert: SQL: ' + sql + ' Values: ' + vals);
  }
  connection = createConnection(sConnectionType);
  connection.connect();
  connection.query(sql, vals, function(err, result) {
    connection.end();
    if (err) {
      if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
        console.log('db.js::doParameterizedInsert: ERROR: ');
        console.log(err);
      }
      callback(err);
      return;
    }
    if ( ! result.hasOwnProperty('insertId') ) {
      // Some kind of SQL error occurred (e.g., ER_TABLEACCESS_DENIED_ERROR, ER_DUP_ENTRY)
      callback(result);
      return;
    }
    callback(null, result.insertId);
    return;
  });
};



// Perform arbitrary update that uses ? placeholders and return generated id using given connection
// Returns (via callback parameter) the results of the update statement
var doParameterizedUpdate = function(sConnectionType, sql, vals, callback) {
  var connection;

  if ( ! config ) { return null; }

  if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
    console.log('db.js::doParameterizedUpdate: SQL: ' + sql + ' Values: ' + vals);
  }
  connection = createConnection(sConnectionType);
  connection.connect();
  connection.query(sql, vals, function(err, result) {
    connection.end();
    if (err) {
      if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
        console.log('db.js::doParameterizedUpdate: ERROR: ');
        console.log(err);
      }
      callback(err);
      return;
    }
    callback(null, result);
    return;
  });
};



// Perform arbitrary delete that uses ? placeholder for id using given connection
// Returns (via callback parameter) the results of the delete statement
var doParameterizedDelete = function(sConnectionType, sql, id, callback) {
  var connection;

  if ( ! config ) { return null; }

  if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
    console.log('db.js::doParameterizedDelete: SQL: ' + sql + ' ID: ' + id);
  }
  connection = createConnection(sConnectionType);
  connection.connect();
  connection.query(sql, [id], function(err, result) {
    connection.end();
    if (err) {
      if ( utilDbDebugLevel === UTIL_DB_DEBUG_LEVEL.ON ) {
        console.log('db.js::doParameterizedDelete: ERROR: ');
        console.log(err);
      }
      callback(err);
      return;
    }
    callback(null, result);
    return;
  });
};



// ========== Public API ==========

module.exports = {
  MYSQL_DEBUG_LEVEL        : MYSQL_DEBUG_LEVEL,
  UTIL_DB_DEBUG_LEVEL      : UTIL_DB_DEBUG_LEVEL,
  setMySqlDebugLevel       : setMySqlDebugLevel,
  setUtilDbDebugLevel      : setUtilDbDebugLevel,
  init                     : init,
  createConnection         : createConnection,
  doParameterizedSql       : doParameterizedSql,
  doParameterizedSqlSingle : doParameterizedSqlSingle,
  doParameterizedInsert    : doParameterizedInsert,
  doParameterizedUpdate    : doParameterizedUpdate,
  doParameterizedDelete    : doParameterizedDelete
};
