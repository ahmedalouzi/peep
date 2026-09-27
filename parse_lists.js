const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
d.data.results.forEach(res => {
  const data = res.response.data;
  console.log(`\n=== LIST: ${data.name} ===`);
  if (data.cards) {
    data.cards.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id})`);
    });
  } else {
    console.log("(no cards)");
  }
});
