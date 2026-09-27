const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

let res = data.data.results[0].responseData || data.data.results[0].response;

let lists;
if (Array.isArray(res)) {
  lists = res;
} else if (res.data) {
  if (res.data.lists) lists = res.data.lists;
  else if (Array.isArray(res.data)) lists = res.data;
} else if (res.lists) {
  lists = res.lists;
}

if (!Array.isArray(lists)) {
  console.log("Could not find lists array. Keys of res:", Object.keys(res));
  return;
}

lists.forEach(list => {
  console.log(`\n=== LIST: ${list.name} ===`);
  if (list.cards && list.cards.length > 0) {
    list.cards.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id})`);
    });
  } else {
    console.log('(empty)');
  }
});
