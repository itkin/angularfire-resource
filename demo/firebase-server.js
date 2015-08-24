var FirebaseServer = require('firebase-server');

FirebaseServer.enableLogging(true);

new FirebaseServer(5000, 'test.firebaseio.com', {
  users: {
    '-JxTmHHaQKFF4pubQDiB':{
      name: "user 1"
    }
  }
});