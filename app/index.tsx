import { Redirect } from 'expo-router';
import { useAppStore } from '../src/store/appStore';

export default function Entry() {
  const { onboardingComplete } = useAppStore();
  return onboardingComplete ? <Redirect href="/(main)" /> : <Redirect href="/(auth)/onboarding" />;
}
