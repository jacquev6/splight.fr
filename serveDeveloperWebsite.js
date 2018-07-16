'use strict'

require('stringify').registerWithRequire(['.html'])

const express = require('express')
const reload = require('reload')

const adminWebsite = require('./splight/adminWebsite')

async function main (inputDataFile) {
  console.log('Starting developer website...')

  const app = express()

  await adminWebsite.populateApp({app, inputDataFile, scripts: ['/reload/reload.js']})

  reload(app)

  app.listen(8000, () => console.log('Developer website live at http://localhost:8000/'))
}

main(process.argv[2])
