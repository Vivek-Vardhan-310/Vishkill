#include <jni.h>
#include <android/asset_manager.h>
#include <android/asset_manager_jni.h>
#include <android/log.h>
#include <stdlib.h>
#include <string.h>
#include "whisper.h"
#include "ggml.h"

#define UNUSED(x) (void)(x)
#define TAG "WhisperJNI"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

struct input_stream_context {
    size_t offset;
    JNIEnv * env;
    jobject input_stream;
    jmethodID mid_available;
    jmethodID mid_read;
};

static size_t inputStreamRead(void * ctx, void * output, size_t read_size) {
    struct input_stream_context * is = (struct input_stream_context *) ctx;

    jint avail_size = (*is->env)->CallIntMethod(is->env, is->input_stream, is->mid_available);
    jint size_to_copy = read_size < avail_size ? (jint) read_size : avail_size;

    jbyteArray byte_array = (*is->env)->NewByteArray(is->env, size_to_copy);
    jint n_read = (*is->env)->CallIntMethod(is->env, is->input_stream, is->mid_read, byte_array, 0, size_to_copy);

    if (size_to_copy != read_size || size_to_copy != n_read) {
        LOGI("Insufficient Read: Req=%zu, ToCopy=%d, Available=%d", read_size, size_to_copy, n_read);
    }

    jbyte * byte_array_elements = (*is->env)->GetByteArrayElements(is->env, byte_array, NULL);
    memcpy(output, byte_array_elements, size_to_copy);
    (*is->env)->ReleaseByteArrayElements(is->env, byte_array, byte_array_elements, JNI_ABORT);
    (*is->env)->DeleteLocalRef(is->env, byte_array);

    is->offset += size_to_copy;
    return size_to_copy;
}

static bool inputStreamEof(void * ctx) {
    struct input_stream_context * is = (struct input_stream_context *) ctx;
    jint result = (*is->env)->CallIntMethod(is->env, is->input_stream, is->mid_available);
    return result <= 0;
}

static void inputStreamClose(void * ctx) {
    UNUSED(ctx);
}

JNIEXPORT jlong JNICALL
Java_com_vishkill_app_monitor_WhisperLib_initContextFromInputStream(
        JNIEnv * env, jclass clazz, jobject input_stream) {
    UNUSED(clazz);

    struct whisper_context * context = NULL;
    struct whisper_model_loader loader = {};
    struct input_stream_context inp_ctx = {};

    inp_ctx.offset = 0;
    inp_ctx.env = env;
    inp_ctx.input_stream = input_stream;

    jclass cls = (*env)->GetObjectClass(env, input_stream);
    inp_ctx.mid_available = (*env)->GetMethodID(env, cls, "available", "()I");
    inp_ctx.mid_read = (*env)->GetMethodID(env, cls, "read", "([BII)I");

    loader.context = &inp_ctx;
    loader.read = inputStreamRead;
    loader.eof = inputStreamEof;
    loader.close = inputStreamClose;

    context = whisper_init(&loader);
    return (jlong) context;
}

static size_t asset_read(void * ctx, void * output, size_t read_size) {
    size_t total_read = 0;
    char * ptr = (char *)output;
    while (total_read < read_size) {
        int n = AAsset_read((AAsset *) ctx, ptr + total_read, read_size - total_read);
        if (n <= 0) break;
        total_read += n;
    }
    return total_read;
}

static bool asset_is_eof(void * ctx) {
    return AAsset_getRemainingLength64((AAsset *) ctx) <= 0;
}

static void asset_close(void * ctx) {
    AAsset_close((AAsset *) ctx);
}

static struct whisper_context * whisper_init_from_asset(JNIEnv * env, jobject assetManager, const char * asset_path) {
    LOGI("Loading model from asset '%s'", asset_path);
    AAssetManager * asset_manager = AAssetManager_fromJava(env, assetManager);
    if (!asset_manager) {
        LOGE("Failed to get AssetManager!");
        return NULL;
    }
    AAsset * asset = AAssetManager_open(asset_manager, asset_path, AASSET_MODE_STREAMING);
    if (!asset) {
        LOGE("Failed to open asset '%s' from AssetManager", asset_path);
        return NULL;
    }
    LOGI("Asset opened successfully, size: %lld bytes", AAsset_getLength64(asset));

    struct whisper_model_loader loader = {
        .context = asset,
        .read = &asset_read,
        .eof = &asset_is_eof,
        .close = &asset_close
    };

    struct whisper_context * ctx = whisper_init_with_params(&loader, whisper_context_default_params());
    if (!ctx) {
        LOGE("whisper_init_with_params returned NULL for asset '%s'", asset_path);
        AAsset_close(asset);
        return NULL;
    }
    LOGI("Whisper context initialized successfully from asset '%s'", asset_path);
    return ctx;
}

JNIEXPORT jlong JNICALL
Java_com_vishkill_app_monitor_WhisperLib_initContextFromAsset(
        JNIEnv * env, jclass clazz, jobject assetManager, jstring asset_path_str) {
    UNUSED(clazz);
    const char * asset_path_chars = (*env)->GetStringUTFChars(env, asset_path_str, NULL);
    struct whisper_context * context = whisper_init_from_asset(env, assetManager, asset_path_chars);
    (*env)->ReleaseStringUTFChars(env, asset_path_str, asset_path_chars);
    return (jlong) context;
}

JNIEXPORT jlong JNICALL
Java_com_vishkill_app_monitor_WhisperLib_initContext(
        JNIEnv * env, jclass clazz, jstring model_path_str) {
    UNUSED(clazz);
    const char * model_path_chars = (*env)->GetStringUTFChars(env, model_path_str, NULL);
    struct whisper_context * context = whisper_init_from_file_with_params(model_path_chars, whisper_context_default_params());
    (*env)->ReleaseStringUTFChars(env, model_path_str, model_path_chars);
    return (jlong) context;
}

JNIEXPORT void JNICALL
Java_com_vishkill_app_monitor_WhisperLib_freeContext(
        JNIEnv * env, jclass clazz, jlong context_ptr) {
    UNUSED(env);
    UNUSED(clazz);
    struct whisper_context * context = (struct whisper_context *) context_ptr;
    whisper_free(context);
}

JNIEXPORT void JNICALL
Java_com_vishkill_app_monitor_WhisperLib_fullTranscribe(
        JNIEnv * env, jclass clazz, jlong context_ptr, jint num_threads, jfloatArray audio_data) {
    UNUSED(clazz);

    struct whisper_context * context = (struct whisper_context *) context_ptr;
    jfloat * audio_data_arr = (*env)->GetFloatArrayElements(env, audio_data, NULL);
    const jsize audio_data_length = (*env)->GetArrayLength(env, audio_data);

    struct whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.print_realtime = false;
    params.print_progress = false;
    params.print_timestamps = false;
    params.print_special = false;
    params.translate = false;
    params.language = "en";
    params.n_threads = num_threads;
    params.offset_ms = 0;
    params.no_context = false;
    params.single_segment = false;
    params.audio_ctx = 64;
    params.initial_prompt = "";  // Empty prompt for pure transcription, no bias

    whisper_reset_timings(context);

    if (whisper_full(context, params, audio_data_arr, audio_data_length) != 0) {
        LOGW("Failed to run whisper_full");
    } else {
        whisper_print_timings(context);
    }

    (*env)->ReleaseFloatArrayElements(env, audio_data, audio_data_arr, JNI_ABORT);
}

JNIEXPORT jint JNICALL
Java_com_vishkill_app_monitor_WhisperLib_getTextSegmentCount(
        JNIEnv * env, jclass clazz, jlong context_ptr) {
    UNUSED(env);
    UNUSED(clazz);
    struct whisper_context * context = (struct whisper_context *) context_ptr;
    return whisper_full_n_segments(context);
}

JNIEXPORT jstring JNICALL
Java_com_vishkill_app_monitor_WhisperLib_getTextSegment(
        JNIEnv * env, jclass clazz, jlong context_ptr, jint index) {
    UNUSED(clazz);
    struct whisper_context * context = (struct whisper_context *) context_ptr;
    const char * text = whisper_full_get_segment_text(context, index);
    return (*env)->NewStringUTF(env, text);
}

JNIEXPORT jlong JNICALL
Java_com_vishkill_app_monitor_WhisperLib_getTextSegmentT0(
        JNIEnv * env, jclass clazz, jlong context_ptr, jint index) {
    UNUSED(env);
    UNUSED(clazz);
    struct whisper_context * context = (struct whisper_context *) context_ptr;
    return whisper_full_get_segment_t0(context, index);
}

JNIEXPORT jlong JNICALL
Java_com_vishkill_app_monitor_WhisperLib_getTextSegmentT1(
        JNIEnv * env, jclass clazz, jlong context_ptr, jint index) {
    UNUSED(env);
    UNUSED(clazz);
    struct whisper_context * context = (struct whisper_context *) context_ptr;
    return whisper_full_get_segment_t1(context, index);
}
