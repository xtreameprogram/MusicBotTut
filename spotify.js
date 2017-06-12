const request = require('request');

module.exports = {
    authenticate: function(client_id, client_secret, cb) {
        var options = {
            method: 'POST',
            url: 'https://accounts.spotify.com/api/token',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                authorization: 'Basic ' + new Buffer(client_id + ":" + client_secret).toString('base64')
            },
            form: {
                grant_type: 'client_credentials'
            }
        };

        request(options, function(error, response, body) {
            if (error) throw new Error(error);
            const auth = JSON.parse(body);
            cb(auth.access_token);
        });

    },

    getPlayList: function(user, playlist, access_token, cb) {
        var options = {
            method: 'GET',
            url: 'https://api.spotify.com/v1/users/' + user + '/playlists/' + playlist + '/tracks',
            headers: {
                authorization: 'Bearer ' + access_token
            }
        };

        request(options, function(error, response, body) {
            if (error) throw new Error(error);

            cb(JSON.parse(body));
        });

    }
}
