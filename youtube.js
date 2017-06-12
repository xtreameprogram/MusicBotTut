const request = require("request");
const getYouTubeID = require('get-youtube-id');

var yt_api_key = "";

module.exports = {
    setApiKey: function (str) {
        yt_api_key = str;
    },
    search_video: function (query, cb) {
        request("https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=" + encodeURIComponent(query) + "&key=" + yt_api_key, function(error, response, body) {
            var json = JSON.parse(body);
            cb(json.items[0].id.videoId);
        });
    },
    isYoutube: function (str) {
        return str.toLowerCase().indexOf("youtube.com") > -1;
    },

    getID: function (str, cb) {
        if (this.isYoutube(str)) {
            cb(getYouTubeID(str));
        } else {
            this.search_video(str, function(id) {
                cb(id);
            });
        }
    },
    getPlayListSongs: function (id, max, cb) {
        request("https://www.googleapis.com/youtube/v3/playlistItems?part=id,snippet&playlistId=" + id + "&maxResults=" + max + "&key=" + yt_api_key, function(error, response, body) {
            var json = JSON.parse(body);
            var arr = [];
            json.items.forEach(function (e) {
                arr.push(e);
            });
            cb(arr.filter(function (a) {
                return a.snippet.title.toLowerCase() !== "private video" && a.snippet.title.toLowerCase() !== "deleted video";
            }));
        });
    },
    getPlayListMetaData: function (id, max, cb) {
        request("https://www.googleapis.com/youtube/v3/playlists?part=snippet%2C+contentDetails&id=" + id + "&maxResults=" + max + "&key=" + yt_api_key, function(error, response, body) {
            cb(JSON.parse(body).items[0]);
        });
    }
};
