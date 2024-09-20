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

// (async () => {
//     const allRecords = await getAllDnsRecords(url)
//     console.table(allRecords)
// })()

// Custom function to print the table with left-aligned columns
function printLeftAlignedTable(data) {
    const headers = Object.keys(data[0]);
    const columnWidths = headers.map(header => {
        return Math.max(...data.map(row => row[header].toString().length), header.length);
    });

    // Print the header row
    const headerRow = headers.map((header, index) => header.padEnd(columnWidths[index], ' ')).join(' | ');
    console.log(headerRow);

    // Print separator
    const separatorRow = columnWidths.map(width => '-'.repeat(width)).join('-|-');
    console.log(separatorRow);

    // Print the data rows
    data.forEach(row => {
        const rowString = headers.map((header, index) => {
            return row[header].toString().padEnd(columnWidths[index], ' ');
        }).join(' | ');
        console.log(rowString);
    });
}

(async () => {
    const allRecords = await getAllDnsRecords(url);

    // Convert the array to an object format that matches the output format of console.table
    const formattedRecords = allRecords.map((record, index) => ({
        index,
        ...record
    }));

    printLeftAlignedTable(formattedRecords);
})();