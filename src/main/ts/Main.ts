import * as Args from './Args';
import * as Dispatch from './Dispatch';

const main = async () => {
  const actualArgs = await Args.parseProcessArgs();
  await Dispatch.dispatch(actualArgs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
