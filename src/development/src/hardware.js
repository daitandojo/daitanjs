import os from 'os';
import si from 'systeminformation'; // Requires 'systeminformation' npm package

/**
 * Checks if the current CPU is supported for TensorFlow operations.
 * @returns {boolean} Whether the CPU is supported.
 */
export const isTensorFlowSupported = () => {
  const cpuModel = os.cpus()[0].model;
  const unsupportedCPUs = ["Intel(R) Celeron(R) J4105 CPU @ 1.50GHz"];
  return !unsupportedCPUs.some(model => cpuModel.includes(model));
};

/**
 * Retrieves detailed information about the CPU.
 * @returns {Object} An object containing CPU information.
 */
export const getCPUInfo = () => {
  const cpus = os.cpus();
  return {
    model: cpus[0].model,
    cores: cpus.length,
    speed: cpus[0].speed, // in MHz
    times: cpus[0].times
  };
};

/**
 * Retrieves the total and free memory of the system.
 * @returns {Object} An object containing memory information.
 */
export const getMemoryInfo = () => {
  return {
    totalMemory: os.totalmem(), // in bytes
    freeMemory: os.freemem(), // in bytes
    usedMemory: os.totalmem() - os.freemem() // in bytes
  };
};

/**
 * Retrieves information about the network interfaces.
 * @returns {Object} An object containing network interfaces information.
 */
export const getNetworkInfo = () => {
  const networkInterfaces = os.networkInterfaces();
  return Object.keys(networkInterfaces).map(interfaceName => {
    return {
      interfaceName,
      addresses: networkInterfaces[interfaceName].map(addr => ({
        address: addr.address,
        family: addr.family,
        mac: addr.mac,
        internal: addr.internal
      }))
    };
  });
};

/**
 * Retrieves information about the operating system.
 * @returns {Object} An object containing OS information.
 */
export const getOSInfo = () => {
  return {
    platform: os.platform(),
    type: os.type(),
    release: os.release(),
    uptime: os.uptime(), // in seconds
    arch: os.arch(),
    hostname: os.hostname()
  };
};

/**
 * Retrieves information about the system's load average.
 * @returns {Object} An object containing load average information.
 */
export const getLoadAverage = () => {
  const load = os.loadavg(); // 1, 5, and 15 minutes load average
  return {
    '1min': load[0],
    '5min': load[1],
    '15min': load[2]
  };
};

/**
 * Retrieves information about connected monitors.
 * @returns {Promise<Object>} An object containing monitor information.
 */
export const getMonitorInfo = async () => {
  const displays = await si.graphics();
  return displays.displays.map(display => ({
    model: display.model,
    resolution: `${display.resolutionx}x${display.resolutiony}`,
    primary: display.primary
  }));
};

/**
 * Retrieves information about connected input devices like mouse and trackpad.
 * @returns {Promise<Object>} An object containing input device information.
 */
export const getInputDevicesInfo = async () => {
  // This feature would need to be implemented with a library that can detect input devices
  // Placeholder example
  return await si.usb(); // This will return USB devices, which might include some input devices
};

/**
 * Retrieves information about audio devices like microphones and speakers.
 * @returns {Promise<Object>} An object containing audio device information.
 */
export const getAudioDevicesInfo = async () => {
  const audio = await si.audio();
  return audio.map(device => ({
    name: device.name,
    driver: device.driver,
    type: device.type
  }));
};

/**
 * Retrieves all hardware information.
 * @returns {Promise<Object>} An object containing all hardware information.
 */
export const getAllHardwareInfo = async () => {
  return {
    cpu: getCPUInfo(),
    memory: getMemoryInfo(),
    network: getNetworkInfo(),
    os: getOSInfo(),
    loadAverage: getLoadAverage(),
    isTensorFlowSupported: isTensorFlowSupported(),
    monitors: await getMonitorInfo(),
    inputDevices: await getInputDevicesInfo(),
    audioDevices: await getAudioDevicesInfo()
  };
};
