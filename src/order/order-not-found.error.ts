export class OrderNotFoundException extends Error {
    id: string
  
    constructor(id: string) {
      super();
      this.id = id;
    }
  }