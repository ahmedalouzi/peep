const regex = /(?:^|\s|'|")((?:\.?\.?\/|\\)?[a-zA-Z0-9_\-\./\\]+\.(?:ts|tsx|js|jsx|json|dart))['"]?:?/g;
const str = 'src/components/Button.tsx(10,2): error TS2339';
let match;
while ((match = regex.exec(str)) !== null) {
  console.log('Matched:', match[1]);
}
