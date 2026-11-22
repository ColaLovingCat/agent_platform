import mitt from "mitt";

type Events = {
  getinfosUser: void;
  jumpHome: void;
  clearSystem: void;
  logout: void;
};

const eventBus = mitt<Events>();

export default eventBus;
