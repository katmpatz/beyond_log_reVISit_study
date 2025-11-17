import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../store/types';
import dataset from "../../beyond_log_study/assets/data-difference.json"
  

const steps_before_blocks = 11;

export default function dynamic({ answers, currentStep, currentBlock }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  

    // Check the length of the answers array
  const filteredAnswers = Object.entries(answers)
    .filter(([key, value]) => key.startsWith(`${currentBlock}_${currentStep}`) && value.endTime > -1);

  // If answer length reaches 10, return null to exit dynamic block
  if (filteredAnswers.length === 10) {
    return { component: null };
  }

  const componentsSeenInBlock = Object.values(answers).filter((a) => a.trialOrder.startsWith(`${currentStep}_`)).length // to control the task component

  const currentTrial = Object.keys(answers).filter((a) => a.startsWith("visblock_")).length; // to control the dataset

  const mod = (componentsSeenInBlock + 1) % 7; // for 6 trials and the seventh return null

  const block = currentBlock.split("_")[1]; // take the first word after _

  const currentComponent =
    mod === 1 || mod === 2
      ? block + '_value'
      : mod >= 3 && mod <= 6
        ? block + '_dif'
        : null;



  return {
    component: currentComponent,
    parameters: {
        currentTrial,
        dataset
    }
  };
}
