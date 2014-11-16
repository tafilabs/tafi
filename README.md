tafi
============

tafi is a node.js module that provides a collection of simple, shared, common functionality

## Installation

  Use an appropriate git version tag to install the desired version of this package.

    $ npm install --save https://github.com/tafilabs/tafi.git#v1.0.1

  Using a git remote url to specify this package can also be used in a 'package.json' file
  to specify this package as a dependency:

  ```
{
  "dependencies": {
    ...
    "tafi": "https://github.com/tafilabs/tafi.git#v1.0.1",
    ...
  }
}
```

A list of tags for this repository is available on GitHub.

## Database Utilities

### Example

Here's an example of how to use the database utility functions:

```
var config, tafi, sql;

configurator = require('configurator');
config = configurator.init({
  /* See configurator repo */
});
tafi = require('tafi.js');

tafi.db.init(config);

// Optional. These can be set within config file using config.mySqlDebugLevel and config.utilDbDebugLevel. Defaults are OFF.
tafi.db.setMySqlDebugLevel(tafi.db.MYSQL_DEBUG_LEVEL.OFF);    /* OFF, QUERIES, ROWS, QUERIES_AND_ROWS, ON */
tafi.db.setUtilDbDebugLevel(tafi.db.UTIL_DB_DEBUG_LEVEL.OFF); /* OFF, ON */

sql = 'select a, b, c from table1 where d = ? and e = ?';
tafi.db.doParameterizedSql('RO', sql, [ 17, 22 ], function(err, rows) {
  if ( err ) {
    // err contains error
    return;
  }
  // rows contain row data as an array of JavaScript objects
});

// Other functions:
// - doParameterizedSqlSingle (Returns first (and assumed only) row as an object rather than as a single-element array)
// - doParameterizedInsert
// - doParameterizedUpdate
// - doParameterizedDelete
```

### Configuration Data

The config object passed to tafi.db.init() might look something like this (uses Configurator):

```
{

  ...

  "mysql_admin_CONFIGURATOR": {
    "dev": {
      "host": "devdb",
      "port": 1234,
      "username": "admin",
      "password": "apple",
      "database": "db1dev"
    },
    "prod": {
      "host": "proddb",
      "port": 4567,
      "username": "admin",
      "password": "apple",
      "database": "db1"
    }
  },
  
  "mysql_rw_CONFIGURATOR": {
    "dev": {
      "host": "devdb",
      "port": 1234,
      "username": "readwrite",
      "password": "banana",
      "database": "db1dev"
    },
    "prod": {
      "host": "proddb",
      "port": 4567,
      "username": "readwrite",
      "password": "banana",
      "database": "db1"
    }
  },
  
  "mysql_ro_CONFIGURATOR": {
    "dev": {
      "host": "devdb",
      "port": 1234,
      "username": "readonly",
      "password": "canteloupe",
      "database": "db1dev"
    },
    "prod": {
      "host": "proddb",
      "port": 4567,
      "username": "readwrite",
      "password": "canteloupe",
      "database": "db1"
    }
  },

  ...
}
```

## Running Tests

 To run the test suite, first invoke the following command within the repo, which installs the development dependencies:

     $ npm install

 then run the tests:

     $ npm test
