export class SW {
  stages: { [key: string]: number } = {};
  private time = 0;
  constructor(private tag: string) {}

  lap = (stage?: string) => {
    const nextTime = new Date().getTime();
    if (stage) {
      this.stages[stage] = nextTime - this.time;
    }
    this.time = nextTime;
  };

  report = () => {
    this.stages["sum"] = Object.values(this.stages).reduce((sum, current) => {
      console.log(sum, current);
      return sum + current;
    });
    console.log(this.tag, this.stages);
  };
}
