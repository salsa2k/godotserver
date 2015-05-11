 function Auth() {
    var $this = this;

    this.handleCommand = function (client, data) {
        switch (data.action) {
            case 'login':
                $this.login(client, data);
                break;
        }
    };

    this.login = function (client, args) {
        if (args.username === 'test' && args.password === 'test') {
            SOCKET.send(client, {'action': 'authorized'});
        } else {
            SOCKET.disconnect(client);
        }
    };
}

module.exports = new Auth();
