import { readFile } from 'fs/promises';
const json = JSON.parse(
  await readFile(
    new URL('./test.json', import.meta.url)
  )
);

// console.log(json)

// for (let i = 0; i < 3; i++) {
//     console.log(json[i])
// }

const db = {"NAME": "", "TWITTER": "", "COMPLEX":false, "PAYPAL":"", "EMAIL": ""};

for (const key in json) {
    if (json.hasOwnProperty(key)) {
        console.log(`${key}: ${json[key]}`);
    }
}