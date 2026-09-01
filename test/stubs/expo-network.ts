export async function getNetworkStateAsync(): Promise<{
  isConnected: boolean;
  isInternetReachable: boolean;
}> {
  return { isConnected: true, isInternetReachable: true };
}
