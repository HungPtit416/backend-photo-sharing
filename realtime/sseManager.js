let clients = [];

function addClient(res) {
  clients.push(res);
}

function removeClient(res) {
  clients = clients.filter((client) => client !== res);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((client) => client.write(payload));
}

module.exports = { addClient, removeClient, broadcast };
