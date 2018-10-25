const colors = require("colors/safe");
const readline = require("readline");

let n = 0;

process.stdout.write(`${colors.blue("The number is:")} ${colors.green("0")}`);

function updateNumber() {
  n++;
  readline.cursorTo(process.stdout, 15);
  readline.clearScreenDown(process.stdout);
  process.stdout.write(colors.green(n.toString()));
}

setInterval(updateNumber, 1000);
