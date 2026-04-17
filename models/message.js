const crypto = require("crypto");
class Message{
    constructor(senderId,content,receiverId,type = 'text'){
        this.id = crypto.randomUUID();  // Unique identifier
        this.senderId = senderId;
        this.content = content;
        this.type = type;
        this.timestamp = new Date();
        this.status = 'sent';
        this.receiverId = receiverId;

    }
    markAsRead(){
        this.status = 'read';
    }
     getFormattedTime() {
    return this.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  toDatabaseFormat() {
    return {
      id: this.id,
      sender_id: this.senderId,
      receiver_id: this.receiverId,
      content: this.content,
      created_at: this.timestamp
    };

}
}

module.exports = Message;