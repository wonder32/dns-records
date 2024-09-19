#!/usr/bin/env node

// node index.js
// https://github.com/LayeredStudio/dns-records
import { getDnsRecords, getAllDnsRecords } from '@layered/dns-records'

// // print process.argv
// process.argv.forEach(function (val, index, array) {
//     console.log(index + ': ' + val);
// });

let url = process.argv[2];

if (typeof url === 'undefined') {
    console.log('Please provide a URL');
    process.exit(1);
}

(async () => {
    const allRecords = await getAllDnsRecords(url)
    console.log('All records', allRecords)
})()
