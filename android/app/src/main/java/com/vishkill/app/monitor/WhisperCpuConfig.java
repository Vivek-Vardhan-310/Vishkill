package com.vishkill.app.monitor;

import android.util.Log;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class WhisperCpuConfig {
    private static final String TAG = "WhisperCpuConfig";

    private WhisperCpuConfig() {
    }

    public static int preferredThreadCount() {
        return Math.max(2, getHighPerfCpuCount());
    }

    private static int getHighPerfCpuCount() {
        try {
            return readCpuInfo().getHighPerfCpuCount();
        } catch (Exception exception) {
            Log.d(TAG, "Couldn't read CPU info", exception);
            return Math.max(1, Runtime.getRuntime().availableProcessors() - 2);
        }
    }

    private static CpuInfo readCpuInfo() throws Exception {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/cpuinfo"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        }
        return new CpuInfo(lines);
    }

    private static final class CpuInfo {
        private final List<String> lines;

        private CpuInfo(List<String> lines) {
            this.lines = lines;
        }

        private int getHighPerfCpuCount() {
            try {
                return getHighPerfCpuCountByFrequencies();
            } catch (Exception exception) {
                Log.d(TAG, "Couldn't read CPU frequencies", exception);
                try {
                    return getHighPerfCpuCountByVariant();
                } catch (Exception variantException) {
                    Log.d(TAG, "Couldn't read CPU variants", variantException);
                    return Math.max(1, Runtime.getRuntime().availableProcessors() - 2);
                }
            }
        }

        private int getHighPerfCpuCountByFrequencies() throws Exception {
            List<Integer> values = getCpuValues("processor", value -> getMaxCpuFrequency(Integer.parseInt(value)));
            return countDroppingMin(values);
        }

        private int getHighPerfCpuCountByVariant() throws Exception {
            List<Integer> values = getCpuValues("CPU variant", value -> Integer.parseInt(value.substring(value.indexOf("0x") + 2), 16));
            return countKeepingMin(values);
        }

        private List<Integer> getCpuValues(String property, Mapper mapper) throws Exception {
            List<Integer> values = new ArrayList<>();
            for (String line : lines) {
                if (!line.startsWith(property)) {
                    continue;
                }
                String value = line.substring(line.indexOf(':') + 1).trim();
                values.add(mapper.map(value));
            }
            Collections.sort(values);
            return values;
        }

        private int countDroppingMin(List<Integer> values) {
            if (values.isEmpty()) {
                return 0;
            }
            int min = values.get(0);
            int count = 0;
            for (int value : values) {
                if (value > min) {
                    count += 1;
                }
            }
            return count;
        }

        private int countKeepingMin(List<Integer> values) {
            if (values.isEmpty()) {
                return 0;
            }
            int min = values.get(0);
            int count = 0;
            for (int value : values) {
                if (value == min) {
                    count += 1;
                }
            }
            return count;
        }

        private int getMaxCpuFrequency(int cpuIndex) throws Exception {
            String path = "/sys/devices/system/cpu/cpu" + cpuIndex + "/cpufreq/cpuinfo_max_freq";
            try (BufferedReader reader = new BufferedReader(new FileReader(path))) {
                return Integer.parseInt(reader.readLine());
            }
        }
    }

    private interface Mapper {
        int map(String value) throws Exception;
    }
}
