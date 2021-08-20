let isBusy = false;

module.exports = {
  getBusy(){
    return isBusy;
  },
  changeBusy(busy){
    isBusy =  busy;
  }
};
