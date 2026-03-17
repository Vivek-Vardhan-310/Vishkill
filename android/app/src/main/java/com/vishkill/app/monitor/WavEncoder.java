package com.vishkill.app.monitor;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

public final class WavEncoder {
    private WavEncoder() {
    }

    public static byte[] wrapPcm16(byte[] pcm, int sampleRate, int channels) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        int byteRate = sampleRate * channels * 2;
        int totalDataLen = pcm.length + 36;

        output.write(new byte[]{'R', 'I', 'F', 'F'});
        writeInt(output, totalDataLen);
        output.write(new byte[]{'W', 'A', 'V', 'E'});
        output.write(new byte[]{'f', 'm', 't', ' '});
        writeInt(output, 16);
        writeShort(output, (short) 1);
        writeShort(output, (short) channels);
        writeInt(output, sampleRate);
        writeInt(output, byteRate);
        writeShort(output, (short) (channels * 2));
        writeShort(output, (short) 16);
        output.write(new byte[]{'d', 'a', 't', 'a'});
        writeInt(output, pcm.length);
        output.write(pcm);
        return output.toByteArray();
    }

    private static void writeInt(ByteArrayOutputStream output, int value) throws IOException {
        output.write(value & 0xff);
        output.write((value >> 8) & 0xff);
        output.write((value >> 16) & 0xff);
        output.write((value >> 24) & 0xff);
    }

    private static void writeShort(ByteArrayOutputStream output, short value) throws IOException {
        output.write(value & 0xff);
        output.write((value >> 8) & 0xff);
    }
}
