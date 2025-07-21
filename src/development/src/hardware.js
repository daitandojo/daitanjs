// development/src/hardware.js
/**
 * @file Hardware and system information utilities.
 * @module @daitanjs/development/hardware
 *
 * @description
 * This module provides functions to retrieve various hardware and system-level
 * information about the environment where the Node.js application is running.
 * It uses Node.js `os` module for basic information and the `systeminformation`
 * library for more detailed data like graphics, USB, and audio devices.
 *
 * Key Functions:
 * - `isTensorFlowSupported()`: Heuristic check for CPU compatibility with TensorFlow.js Node.
 * - `getCPUInfo()`: CPU model, cores, speed, and aggregated load times.
 * - `getMemoryInfo()`: Total, free, and used system memory.
 * - `getNetworkInfo()`: Details about network interfaces.
 * - `getOSInfo()`: OS platform, type, release, uptime, architecture, hostname.
 * - `getLoadAverage()`: System load averages (1, 5, 15 minutes).
 * - `getGraphicsAndDisplayInfo()`: Information about graphics controllers and displays (uses `systeminformation`).
 * - `getUsbDevicesInfo()`: Information about connected USB devices (uses `systeminformation`).
 * - `getAudioDevicesInfo()`: Information about audio devices (uses `systeminformation`).
 * - `getAllHardwareInfo()`: A comprehensive report combining information from most other functions.
 *
 * Error Handling:
 * Functions involving external libraries like `systeminformation` may throw `DaitanOperationError`
 * if the library fails. Basic OS calls are wrapped to return default/error objects on failure.
 */
import os from 'os';
import si from 'systeminformation'; // systeminformation for more detailed hardware info
import { getLogger } from './logger.js'; // Using the logger from the same package
import { DaitanOperationError, DaitanInvalidInputError } from '@daitanjs/error';

const hardwareLogger = getLogger('daitan-hardware-info');

/**
 * Checks if the current CPU model is known to have issues with TensorFlow.js Node,
 * particularly older Intel Celeron/Atom CPUs that may lack AVX/AVX2 support
 * required by default TensorFlow.js Node bindings.
 * This is a heuristic based on a list of known problematic CPU model fragments.
 *
 * @public
 * @returns {boolean} True if TensorFlow.js Node is likely supported based on CPU model,
 *                    false if CPU is on a known problematic list. Defaults to true if CPU info cannot be retrieved or on error.
 */
export const isTensorFlowSupported = () => {
  const callId = `tfSupportCheck-${Date.now().toString(36)}`;
  try {
    const cpus = os.cpus();
    if (!cpus || cpus.length === 0) {
      hardwareLogger.warn(`[${callId}] Could not retrieve CPU information to check TensorFlow.js Node support. Assuming supported.`);
      return true; // Default to supported if CPU info is unavailable
    }

    const cpuModel = cpus[0].model.toLowerCase(); // Standardize to lowercase for matching

    // List of CPU model fragments known or suspected to lack AVX/AVX2 or have other issues
    // This list should be maintained and updated based on community feedback and testing.
    const unsupportedCPUsFragments = [
      'celeron n', // Catches Celeron N4000, N3350, N3450, etc.
      'celeron j', // Catches Celeron J4105, J1900, etc.
      'atom x5-', // e.g., Atom x5-Z8350
      'atom z37', // e.g., Atom Z3735F
      'atom d',   // e.g., Atom D2550
      'pentium n',// e.g., Pentium N3540, N3710
      'pentium j',// e.g., Pentium J2900
      // Add other known problematic CPU model fragments here
      // Older Core 2 Duos, some very early i3/i5 might also lack AVX.
      // Consider adding checks for specific CPU flags if `systeminformation` provides them easily.
    ];

    const isUnsupported = unsupportedCPUsFragments.some(fragment => cpuModel.includes(fragment));

    if (isUnsupported) {
      hardwareLogger.info(`[${callId}] CPU model "${cpus[0].model}" is on the list of CPUs that may lack AVX/AVX2 or have other known issues with default TensorFlow.js Node bindings. Returning false for TensorFlow support.`);
    } else {
      hardwareLogger.debug(`[${callId}] CPU model "${cpus[0].model}" not on the known unsupported list for TensorFlow.js Node. Assuming supported (AVX/AVX2 likely present).`);
    }
    return !isUnsupported;
  } catch (error) {
    hardwareLogger.warn(`[${callId}] Error checking CPU for TensorFlow.js Node support: ${error.message}. Assuming supported.`, { errorName: error.name });
    return true; // Default to supported on error
  }
};

/**
 * Retrieves detailed information about the system's CPU(s).
 *
 * @public
 * @returns {{model: string, cores: number, physicalCores?: number, speed: number, manufacturer?: string, brand?: string, vendor?: string, family?: string, modelCpu?: string, stepping?: string, revision?: string, voltage?: string, speedMin?: number, speedMax?: number, governor?: string, cache?: object, flags?: string, virtualization?: boolean, aggregatedTimes: object, error?: string}}
 *          An object containing detailed CPU information from `os.cpus()` and `systeminformation`.
 *          `aggregatedTimes` provides system-wide CPU load times (user, nice, sys, idle, irq).
 *          Returns a default error object if `os.cpus()` fails or basic info cannot be obtained.
 *          Fields from `systeminformation` are best-effort and might be undefined if `si.cpu()` fails.
 */
export const getCPUInfo = () => {
  const callId = `cpuInfo-${Date.now().toString(36)}`;
  hardwareLogger.debug(`[${callId}] Fetching CPU information...`);
  try {
    const cpusOs = os.cpus(); // From Node.js 'os' module
    if (!cpusOs || cpusOs.length === 0) {
      hardwareLogger.warn(`[${callId}] os.cpus() returned no data. Basic CPU info will be unavailable.`);
      // Try to get systeminformation even if os.cpus fails for some reason
      return si.cpu()
        .then(siCpuData => ({
            model: siCpuData.brand || 'N/A (os.cpus failed)',
            cores: siCpuData.cores || 0,
            physicalCores: siCpuData.physicalCores,
            speed: siCpuData.speed || 0, // Speed in GHz from systeminformation
            manufacturer: siCpuData.manufacturer,
            brand: siCpuData.brand,
            vendor: siCpuData.vendor,
            family: siCpuData.family,
            modelCpu: siCpuData.model,
            stepping: siCpuData.stepping,
            revision: siCpuData.revision,
            voltage: siCpuData.voltage,
            speedMin: siCpuData.speedMin,
            speedMax: siCpuData.speedMax,
            governor: siCpuData.governor,
            cache: siCpuData.cache,
            flags: siCpuData.flags,
            virtualization: siCpuData.virtualization,
            aggregatedTimes: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }, // No load times from si.cpu() directly
            error: 'os.cpus() failed to provide data.'
        }))
        .catch(siError => {
            hardwareLogger.error(`[${callId}] Both os.cpus() and systeminformation.cpu() failed.`, { siError: siError.message });
            return { model: 'Error Retrieving', cores: 0, speed: 0, aggregatedTimes: {}, error: `os.cpus() and si.cpu() failed: ${siError.message}` };
        });
    }

    // Aggregate times from os.cpus()
    const aggregatedTimes = cpusOs.reduce((acc, cpu) => {
      Object.keys(cpu.times).forEach(key => {
        acc[key] = (acc[key] || 0) + cpu.times[key];
      });
      return acc;
    }, { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }); // Initialize with all keys

    // Fetch additional details from systeminformation and merge
    // This is now async due to si.cpu()
    return si.cpu()
        .then(siCpuData => {
            hardwareLogger.info(`[${callId}] CPU information retrieved successfully (combined os and systeminformation).`);
            return {
                model: cpusOs[0].model, // Prefer os.cpus model string as primary
                cores: cpusOs.length, // Logical cores from os.cpus
                physicalCores: siCpuData.physicalCores,
                speed: cpusOs[0].speed, // Speed in MHz from os.cpus
                manufacturer: siCpuData.manufacturer,
                brand: siCpuData.brand, // Often more descriptive than os.cpus model
                vendor: siCpuData.vendor,
                family: siCpuData.family,
                modelCpu: siCpuData.model, // Systeminformation's model identifier
                stepping: siCpuData.stepping,
                revision: siCpuData.revision,
                voltage: siCpuData.voltage,
                speedMin: siCpuData.speedMin, // Speed in GHz
                speedMax: siCpuData.speedMax, // Speed in GHz
                governor: siCpuData.governor,
                cache: siCpuData.cache, // L1d, L1i, L2, L3 cache sizes in bytes
                flags: siCpuData.flags, // CPU flags (e.g., "avx", "sse")
                virtualization: siCpuData.virtualization,
                aggregatedTimes: aggregatedTimes, // From os.cpus
            };
        })
        .catch(siError => {
            hardwareLogger.warn(`[${callId}] systeminformation.cpu() failed: ${siError.message}. Returning os.cpus() data only.`, { errorName: siError.name });
            return {
                model: cpusOs[0].model,
                cores: cpusOs.length,
                speed: cpusOs[0].speed,
                aggregatedTimes: aggregatedTimes,
                errorPartial: `systeminformation.cpu() failed: ${siError.message}`,
            };
        });

  } catch (error) { // Catch errors from os.cpus() itself
    hardwareLogger.error(`[${callId}] Error retrieving CPU info via os.cpus(): ${error.message}`, { errorName: error.name });
    return Promise.resolve({ model: 'Error Retrieving', cores: 0, speed: 0, aggregatedTimes: {}, error: error.message });
  }
};

/**
 * Retrieves total, free, and used system memory.
 * Provides values in bytes and human-readable GB.
 *
 * @public
 * @returns {{totalMemoryBytes: number, freeMemoryBytes: number, usedMemoryBytes: number, totalMemoryGB: number, freeMemoryGB: number, usedMemoryGB: number, error?: string}}
 *          An object containing memory information. Returns an error object if `os.totalmem()` or `os.freemem()` fail.
 */
export const getMemoryInfo = () => {
  const callId = `memInfo-${Date.now().toString(36)}`;
  hardwareLogger.debug(`[${callId}] Fetching memory information...`);
  try {
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes;

    const bytesToGB = (bytes) => parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(2));

    const memoryInfo = {
      totalMemoryBytes,
      freeMemoryBytes,
      usedMemoryBytes,
      totalMemoryGB: bytesToGB(totalMemoryBytes),
      freeMemoryGB: bytesToGB(freeMemoryBytes),
      usedMemoryGB: bytesToGB(usedMemoryBytes),
    };
    hardwareLogger.info(`[${callId}] Memory information retrieved successfully.`);
    return memoryInfo;
  } catch (error) {
    hardwareLogger.error(`[${callId}] Error retrieving memory info: ${error.message}`, { errorName: error.name });
    return { totalMemoryBytes: 0, freeMemoryBytes: 0, usedMemoryBytes: 0, totalMemoryGB: 0, freeMemoryGB: 0, usedMemoryGB: 0, error: error.message };
  }
};

/**
 * Retrieves information about network interfaces, including IP addresses and MAC addresses.
 *
 * @public
 * @returns {object | {error: string}} An object mapping interface names to their address information,
 *          or an error object if retrieval fails.
 */
export const getNetworkInfo = () => {
  const callId = `netInfo-${Date.now().toString(36)}`;
  hardwareLogger.debug(`[${callId}] Fetching network interface information...`);
  try {
    const networkInterfaces = os.networkInterfaces();
    // Simplify structure slightly if needed, or just return the raw os.networkInterfaces() object.
    const simplifiedInterfaces = {};
    for (const name in networkInterfaces) {
      if (Object.hasOwnProperty.call(networkInterfaces, name)) {
          simplifiedInterfaces[name] = networkInterfaces[name].map(iface => ({
            address: iface.address,
            netmask: iface.netmask,
            family: iface.family,
            mac: iface.mac,
            internal: iface.internal,
            cidr: iface.cidr, // Available in newer Node versions
          }));
      }
    }
    hardwareLogger.info(`[${callId}] Network interface information retrieved for ${Object.keys(simplifiedInterfaces).length} interfaces.`);
    return simplifiedInterfaces;
  } catch (error) {
    hardwareLogger.error(`[${callId}] Error retrieving network info: ${error.message}`, { errorName: error.name });
    return { error: error.message };
  }
};

/**
 * Retrieves information about the operating system.
 *
 * @public
 * @returns {{platform: string, type: string, release: string, uptimeSeconds: number, architecture: string, hostname: string, endianness: string, userInfo?: object, homedir?: string, error?: string}}
 *          An object containing OS details. `userInfo` and `homedir` are commented out for privacy unless explicitly needed.
 *          Returns an error object if retrieval fails.
 */
export const getOSInfo = () => {
  const callId = `osInfo-${Date.now().toString(36)}`;
  hardwareLogger.debug(`[${callId}] Fetching OS information...`);
  try {
    const osInfo = {
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      uptimeSeconds: os.uptime(),
      architecture: os.arch(),
      hostname: os.hostname(),
      endianness: os.endianness(),
      // userInfo: os.userInfo(), // Potentially sensitive PII, enable with caution
      // homedir: os.homedir(),  // Potentially sensitive, enable with caution
    };
    hardwareLogger.info(`[${callId}] OS information retrieved successfully. Platform: ${osInfo.platform}, Release: ${osInfo.release}`);
    return osInfo;
  } catch (error) {
    hardwareLogger.error(`[${callId}] Error retrieving OS info: ${error.message}`, { errorName: error.name });
    return { error: error.message };
  }
};

/**
 * Retrieves the system's load average (1, 5, and 15 minute averages).
 * Note: Load average is typically most meaningful on Unix-like systems. On Windows, it might return `[0, 0, 0]`.
 *
 * @public
 * @returns {{ '1min': number, '5min': number, '15min': number, error?: string }}
 *          An object containing load average information, or an error object.
 */
export const getLoadAverage = () => {
  const callId = `loadAvg-${Date.now().toString(36)}`;
  hardwareLogger.debug(`[${callId}] Fetching system load average...`);
  try {
    const load = os.loadavg(); // Returns an array [1m, 5m, 15m]
    const loadAverage = {
      '1min': load[0],
      '5min': load[1],
      '15min': load[2],
    };
    hardwareLogger.info(`[${callId}] System load average retrieved: ${load.join(', ')}`);
    return loadAverage;
  } catch (error) {
    hardwareLogger.error(`[${callId}] Error retrieving load average: ${error.message}`, { errorName: error.name });
    return { '1min': 0, '5min': 0, '15min': 0, error: error.message };
  }
};

/**
 * Retrieves information about connected graphics controllers and displays using `systeminformation`.
 *
 * @public
 * @async
 * @returns {Promise<object>} An object containing arrays of `controllers` and `displays` information.
 *          Each controller includes vendor, model, bus, VRAM. Each display includes model, resolution, connection type.
 * @throws {DaitanOperationError} If `systeminformation.graphics()` fails.
 */
export const getGraphicsAndDisplayInfo = async () => {
  const callId = `gfxInfo-${Date.now().toString(36)}`;
  hardwareLogger.debug(`[${callId}] Fetching graphics and display information via systeminformation...`);
  try {
    const graphicsData = await si.graphics();
    hardwareLogger.info(`[${callId}] Graphics and display information retrieved. Controllers: ${graphicsData.controllers.length}, Displays: ${graphicsData.displays.length}`);
    return {
      controllers: graphicsData.controllers.map(c => ({
        vendor: c.vendor, model: c.model, bus: c.bus, vramMB: c.vram, vramDynamic: c.vramDynamic, // Added vramDynamic
      })),
      displays: graphicsData.displays.map(d => ({
        vendor: d.vendor, model: d.model, main: d.main, builtIn: d.builtin, connection: d.connection,
        resolutionX: d.resolutionx, resolutionY: d.resolutiony, pixelDepth: d.pixeldepth,
        currentRefreshRate: d.currentrefreshrate, sizeXCm: d.sizex, sizeYCm: d.sizey, // Added physical size
      })),
    };
  } catch (error) {
    hardwareLogger.error(`[${callId}] Error retrieving graphics/display info via systeminformation: ${error.message}`, { errorName: error.name });
    throw new DaitanOperationError(`Failed to get graphics/display info using systeminformation: ${error.message}`, {}, error);
  }
};

/**
 * Retrieves information about connected USB devices using `systeminformation`.
 * This can include various peripherals like keyboards, mice, webcams, and storage devices.
 *
 * @public
 * @async
 * @returns {Promise<Array<object>>} An array of USB device information objects, each including
 *          id, bus, deviceId, name, type, vendor, manufacturer.
 * @throws {DaitanOperationError} If `systeminformation.usb()` fails.
 */
export const getUsbDevicesInfo = async () => {
  const callId = `usbInfo-${Date.now().toString(36)}`;
  hardwareLogger.debug(`[${callId}] Fetching USB devices information via systeminformation...`);
  try {
    const usbData = await si.usb();
    hardwareLogger.info(`[${callId}] USB devices information retrieved: ${usbData.length} devices found.`);
    return usbData.map(d => ({
      id: d.id, bus: d.bus, deviceId: d.deviceId, name: d.name, type: d.type,
      vendor: d.vendor, manufacturer: d.manufacturer, maxPower: d.maxPower, // Added maxPower
      serialNumber: d.serial // Added serialNumber
    }));
  } catch (error) {
    hardwareLogger.error(`[${callId}] Error retrieving USB devices info via systeminformation: ${error.message}`, { errorName: error.name });
    throw new DaitanOperationError(`Failed to get USB devices info using systeminformation: ${error.message}`, {}, error);
  }
};

/**
 * Retrieves information about audio devices (sound cards, input/output devices) using `systeminformation`.
 *
 * @public
 * @async
 * @returns {Promise<Array<object>>} An array of audio device information objects, each including
 *          id, name, manufacturer, type (e.g., 'playback', 'recording'), default status, and operational status.
 * @throws {DaitanOperationError} If `systeminformation.audio()` fails.
 */
export const getAudioDevicesInfo = async () => {
  const callId = `audioInfo-${Date.now().toString(36)}`;
  hardwareLogger.debug(`[${callId}] Fetching audio devices information via systeminformation...`);
  try {
    const audioData = await si.audio();
    hardwareLogger.info(`[${callId}] Audio devices information retrieved: ${audioData.length} devices found.`);
    return audioData.map(d => ({
      id: d.id, name: d.name, manufacturer: d.manufacturer, type: d.type,
      default: d.default, // Is it a system default device?
      status: d.status, // Operational status if available
      channel: d.channel, // e.g., 'input', 'output'
      driver: d.driver, // Driver name
    }));
  } catch (error) {
    hardwareLogger.error(`[${callId}] Error retrieving audio devices info via systeminformation: ${error.message}`, { errorName: error.name });
    throw new DaitanOperationError(`Failed to get audio devices info using systeminformation: ${error.message}`, {}, error);
  }
};

/**
 * Retrieves a comprehensive set of hardware and system information by calling
 * most of the other functions in this module.
 * Failures in `systeminformation`-based calls are caught individually to allow
 * the rest of the information to be returned.
 *
 * @public
 * @async
 * @returns {Promise<object>} An object containing all gathered hardware and system information.
 *          Properties with errors during fetching will have an `error` sub-property.
 */
export const getAllHardwareInfo = async () => {
  const callId = `allHwInfo-${Date.now().toString(36)}`;
  hardwareLogger.info(`[${callId}] Fetching all hardware and system information...`);
  const overallStartTime = Date.now();

  // CPU info is now async because it incorporates si.cpu()
  const cpuInfoPromise = getCPUInfo().catch(e => {
      hardwareLogger.warn(`[${callId}] Failed to get CPU info for getAllHardwareInfo: ${e.message}. Using defaults.`);
      return { model: 'Error', cores: 0, speed: 0, aggregatedTimes: {}, error: e.message };
  });

  const [
    cpuData, // Result of the now async getCPUInfo
    graphicsInfo,
    usbInfo,
    audioInfo,
    // Other systeminformation calls can be added here
    // systemData, biosData, baseboardData, diskLayoutData, batteryData
  ] = await Promise.allSettled([ // Use allSettled to ensure all promises complete
    cpuInfoPromise,
    getGraphicsAndDisplayInfo(),
    getUsbDevicesInfo(),
    getAudioDevicesInfo(),
    // Example: si.system(), si.bios(), si.baseboard(), si.diskLayout(), si.battery()
  ]);

  const processPromiseSettledResult = (settledResult, fieldName, defaultValue = { error: "Failed to fetch" }) => {
    if (settledResult.status === 'fulfilled') {
      return settledResult.value;
    } else {
      hardwareLogger.warn(`[${callId}] Failed to get ${fieldName} for getAllHardwareInfo: ${settledResult.reason.message}`);
      return { ...defaultValue, error: settledResult.reason.message };
    }
  };

  const allInfo = {
    isTensorFlowCpuSupported: isTensorFlowSupported(), // This is synchronous
    cpu: processPromiseSettledResult(cpuData, "CPU Info", { model: 'Error', cores: 0, speed: 0, aggregatedTimes: {} }),
    memory: getMemoryInfo(), // Synchronous
    os: getOSInfo(), // Synchronous
    networkInterfaces: getNetworkInfo(), // Synchronous
    loadAverage: getLoadAverage(), // Synchronous
    graphicsAndDisplays: processPromiseSettledResult(graphicsInfo, "Graphics/Displays", { controllers: [], displays: [] }),
    usbDevices: processPromiseSettledResult(usbInfo, "USB Devices", []),
    audioDevices: processPromiseSettledResult(audioInfo, "Audio Devices", []),
    // system: processPromiseSettledResult(systemData, "System (si.system)", {}),
    // bios: processPromiseSettledResult(biosData, "BIOS (si.bios)", {}),
    // baseboard: processPromiseSettledResult(baseboardData, "Baseboard (si.baseboard)", {}),
    // diskLayout: processPromiseSettledResult(diskLayoutData, "Disk Layout (si.diskLayout)", []),
    // battery: processPromiseSettledResult(batteryData, "Battery (si.battery)", {}),
  };

  hardwareLogger.info(`[${callId}] All hardware information aggregated. Duration: ${Date.now() - overallStartTime}ms`);
  return allInfo;
};