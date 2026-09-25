<?php
/**
 * Plugin Name: Arkan Gold — استعلام اصالت شمش
 * Description: ثبت سریال شمش‌های آرکان گلد و ارائه API عمومی استعلام اصالت برای صفحه arkan.gold/verify.
 * Version:     1.0.0
 * Author:      Arkan Gold
 * Requires PHP: 7.4
 *
 * API:
 *   GET /wp-json/arkan/v1/verify-bar?serial=AG750-000123&code=4821
 *
 * پاسخ‌ها:
 *   200 {"valid":true,"status":"valid","serial":"...","product":"...","weight":1,"purity":750,"manufactured_at":"2026-05-01"}
 *   200 {"valid":false,"status":"code_required"}   ← برای این سریال کد امنیتی ثبت شده ولی ارسال نشده
 *   200 {"valid":false,"status":"revoked"}         ← سریال باطل/مفقودی اعلام شده
 *   404 {"valid":false,"status":"not_found"}
 *   429 {"valid":false,"status":"rate_limited"}
 *
 * فقط اطلاعات عمومی شمش برگردانده می‌شود؛ هیچ اطلاعاتی از خریدار در این API وجود ندارد.
 */

if (!defined('ABSPATH')) {
    exit;
}

const ARKAN_BAR_CPT = 'arkan_bar';
const ARKAN_BAR_RATE_LIMIT = 30;          // حداکثر درخواست
const ARKAN_BAR_RATE_WINDOW = 10 * 60;    // در هر ۱۰ دقیقه برای هر IP

/** سریال/کد: اعداد فارسی به لاتین، حروف بزرگ، حذف فاصله */
function arkan_bar_normalize($value)
{
    $value = (string) $value;
    $value = strtr($value, [
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
        '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
        '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
    ]);
    $value = preg_replace('/\s+/u', '', $value);
    return strtoupper(sanitize_text_field($value));
}

/* ------------------------------------------------------------------
 * نوع محتوای «شمش» (فقط در پیشخوان، غیرعمومی)
 * ------------------------------------------------------------------ */
add_action('init', function () {
    register_post_type(ARKAN_BAR_CPT, [
        'labels' => [
            'name'          => 'شمش‌های آرکان',
            'singular_name' => 'شمش',
            'add_new'       => 'ثبت شمش جدید',
            'add_new_item'  => 'ثبت شمش جدید',
            'edit_item'     => 'ویرایش شمش',
            'search_items'  => 'جستجوی سریال',
            'not_found'     => 'شمشی یافت نشد',
        ],
        'public'          => false,
        'show_ui'         => true,
        'show_in_menu'    => true,
        'menu_icon'       => 'dashicons-shield',
        'supports'        => ['title'],
        'capability_type' => 'post',
        'map_meta_cap'    => true,
    ]);
});

function arkan_bar_fields()
{
    return [
        '_ab_serial'          => 'شماره سریال',
        '_ab_code'            => 'کد امنیتی (اختیاری)',
        '_ab_product'         => 'نام محصول',
        '_ab_weight'          => 'وزن (گرم)',
        '_ab_purity'          => 'عیار',
        '_ab_manufactured_at' => 'تاریخ تولید (مثلا 2026-05-01 یا ۱۴۰۵/۰۲/۱۱)',
    ];
}

add_action('add_meta_boxes', function () {
    add_meta_box('arkan_bar_details', 'مشخصات شمش', 'arkan_bar_render_meta_box', ARKAN_BAR_CPT, 'normal', 'high');
});

function arkan_bar_render_meta_box($post)
{
    wp_nonce_field('arkan_bar_save', 'arkan_bar_nonce');
    echo '<table class="form-table">';
    foreach (arkan_bar_fields() as $key => $label) {
        $value = get_post_meta($post->ID, $key, true);
        if ($key === '_ab_purity' && $value === '') {
            $value = '750';
        }
        printf(
            '<tr><th><label for="%1$s">%2$s</label></th><td><input type="text" id="%1$s" name="%1$s" value="%3$s" class="regular-text" dir="ltr"></td></tr>',
            esc_attr($key),
            esc_html($label),
            esc_attr($value)
        );
    }
    $status = get_post_meta($post->ID, '_ab_status', true) ?: 'valid';
    echo '<tr><th><label for="_ab_status">وضعیت</label></th><td><select id="_ab_status" name="_ab_status">';
    foreach (['valid' => 'معتبر', 'revoked' => 'باطل / مفقودی'] as $k => $l) {
        printf('<option value="%s"%s>%s</option>', esc_attr($k), selected($status, $k, false), esc_html($l));
    }
    echo '</select></td></tr></table>';
}

add_action('save_post_' . ARKAN_BAR_CPT, function ($post_id) {
    if (!isset($_POST['arkan_bar_nonce']) || !wp_verify_nonce(sanitize_key($_POST['arkan_bar_nonce']), 'arkan_bar_save')) {
        return;
    }
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }
    if (!current_user_can('edit_post', $post_id)) {
        return;
    }
    foreach (array_keys(arkan_bar_fields()) as $key) {
        if (!isset($_POST[$key])) {
            continue;
        }
        $raw = wp_unslash($_POST[$key]);
        $value = in_array($key, ['_ab_serial', '_ab_code'], true) ? arkan_bar_normalize($raw) : sanitize_text_field($raw);
        update_post_meta($post_id, $key, $value);
    }
    $status = isset($_POST['_ab_status']) && $_POST['_ab_status'] === 'revoked' ? 'revoked' : 'valid';
    update_post_meta($post_id, '_ab_status', $status);

    // عنوان پست = سریال (برای جستجو در پیشخوان)
    $serial = get_post_meta($post_id, '_ab_serial', true);
    if ($serial && get_the_title($post_id) !== $serial) {
        remove_all_actions('save_post_' . ARKAN_BAR_CPT);
        wp_update_post(['ID' => $post_id, 'post_title' => $serial]);
    }
});

/* ستون‌های فهرست شمش‌ها در پیشخوان */
add_filter('manage_' . ARKAN_BAR_CPT . '_posts_columns', function ($cols) {
    return [
        'cb'         => $cols['cb'],
        'title'      => 'سریال',
        'ab_product' => 'محصول',
        'ab_weight'  => 'وزن',
        'ab_status'  => 'وضعیت',
        'date'       => $cols['date'],
    ];
});
add_action('manage_' . ARKAN_BAR_CPT . '_posts_custom_column', function ($col, $post_id) {
    if ($col === 'ab_product') {
        echo esc_html(get_post_meta($post_id, '_ab_product', true));
    } elseif ($col === 'ab_weight') {
        echo esc_html(get_post_meta($post_id, '_ab_weight', true));
    } elseif ($col === 'ab_status') {
        echo get_post_meta($post_id, '_ab_status', true) === 'revoked' ? '❌ باطل' : '✅ معتبر';
    }
}, 10, 2);

/* ------------------------------------------------------------------
 * درون‌ریزی گروهی از CSV
 * ستون‌ها: serial,code,product,weight,purity,manufactured_at,status
 * ------------------------------------------------------------------ */
add_action('admin_menu', function () {
    add_submenu_page(
        'edit.php?post_type=' . ARKAN_BAR_CPT,
        'درون‌ریزی CSV',
        'درون‌ریزی CSV',
        'edit_posts',
        'arkan-bar-import',
        'arkan_bar_render_import_page'
    );
});

function arkan_bar_find_by_serial($serial)
{
    $ids = get_posts([
        'post_type'      => ARKAN_BAR_CPT,
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'no_found_rows'  => true,
        'meta_query'     => [['key' => '_ab_serial', 'value' => $serial]],
    ]);
    return $ids ? (int) $ids[0] : 0;
}

function arkan_bar_render_import_page()
{
    if (!current_user_can('edit_posts')) {
        return;
    }
    $message = '';
    if (!empty($_FILES['arkan_bar_csv']['tmp_name']) && check_admin_referer('arkan_bar_import')) {
        $handle = fopen($_FILES['arkan_bar_csv']['tmp_name'], 'r');
        $created = 0;
        $updated = 0;
        $header = null;
        while ($handle && ($row = fgetcsv($handle)) !== false) {
            if ($header === null) {
                $header = array_map(function ($h) {
                    return strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', $h)));
                }, $row);
                continue;
            }
            $data = array_combine($header, array_pad($row, count($header), ''));
            $serial = arkan_bar_normalize($data['serial'] ?? '');
            if (!$serial) {
                continue;
            }
            $post_id = arkan_bar_find_by_serial($serial);
            if (!$post_id) {
                $post_id = wp_insert_post(['post_type' => ARKAN_BAR_CPT, 'post_status' => 'publish', 'post_title' => $serial]);
                $created++;
            } else {
                $updated++;
            }
            update_post_meta($post_id, '_ab_serial', $serial);
            update_post_meta($post_id, '_ab_code', arkan_bar_normalize($data['code'] ?? ''));
            update_post_meta($post_id, '_ab_product', sanitize_text_field($data['product'] ?? ''));
            update_post_meta($post_id, '_ab_weight', sanitize_text_field($data['weight'] ?? ''));
            update_post_meta($post_id, '_ab_purity', sanitize_text_field(($data['purity'] ?? '') ?: '750'));
            update_post_meta($post_id, '_ab_manufactured_at', sanitize_text_field($data['manufactured_at'] ?? ''));
            update_post_meta($post_id, '_ab_status', ($data['status'] ?? '') === 'revoked' ? 'revoked' : 'valid');
        }
        if ($handle) {
            fclose($handle);
        }
        $message = sprintf('%d شمش جدید ثبت و %d شمش به‌روزرسانی شد.', $created, $updated);
    }
    echo '<div class="wrap"><h1>درون‌ریزی سریال شمش‌ها</h1>';
    if ($message) {
        echo '<div class="notice notice-success"><p>' . esc_html($message) . '</p></div>';
    }
    echo '<p>فایل CSV با ستون‌های <code>serial,code,product,weight,purity,manufactured_at,status</code> (status: valid یا revoked).</p>';
    echo '<form method="post" enctype="multipart/form-data">';
    wp_nonce_field('arkan_bar_import');
    echo '<input type="file" name="arkan_bar_csv" accept=".csv" required> ';
    submit_button('درون‌ریزی', 'primary', 'submit', false);
    echo '</form></div>';
}

/* ------------------------------------------------------------------
 * REST API عمومی استعلام
 * ------------------------------------------------------------------ */
add_action('rest_api_init', function () {
    register_rest_route('arkan/v1', '/verify-bar', [
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'args'                => [
            'serial' => ['required' => true, 'type' => 'string'],
            'code'   => ['required' => false, 'type' => 'string'],
        ],
        'callback'            => 'arkan_bar_verify_endpoint',
    ]);
});

function arkan_bar_verify_endpoint(WP_REST_Request $request)
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    $rl_key = 'arkan_bar_rl_' . md5($ip);
    $hits = (int) get_transient($rl_key);
    if ($hits >= ARKAN_BAR_RATE_LIMIT) {
        return arkan_bar_response(['valid' => false, 'status' => 'rate_limited'], 429);
    }
    set_transient($rl_key, $hits + 1, ARKAN_BAR_RATE_WINDOW);

    $serial = arkan_bar_normalize($request->get_param('serial'));
    $code = arkan_bar_normalize($request->get_param('code') ?? '');
    if (!preg_match('/^[A-Z0-9-]{4,32}$/', $serial)) {
        return arkan_bar_response(['valid' => false, 'status' => 'not_found'], 404);
    }

    $post_id = arkan_bar_find_by_serial($serial);
    if (!$post_id) {
        return arkan_bar_response(['valid' => false, 'status' => 'not_found'], 404);
    }

    $stored_code = (string) get_post_meta($post_id, '_ab_code', true);
    if ($stored_code !== '') {
        if ($code === '') {
            return arkan_bar_response(['valid' => false, 'status' => 'code_required'], 200);
        }
        if (!hash_equals($stored_code, $code)) {
            return arkan_bar_response(['valid' => false, 'status' => 'not_found'], 404);
        }
    }

    if (get_post_meta($post_id, '_ab_status', true) === 'revoked') {
        return arkan_bar_response(['valid' => false, 'status' => 'revoked', 'serial' => $serial], 200);
    }

    $weight = get_post_meta($post_id, '_ab_weight', true);
    $purity = get_post_meta($post_id, '_ab_purity', true);
    return arkan_bar_response([
        'valid'           => true,
        'status'          => 'valid',
        'serial'          => $serial,
        'product'         => (string) get_post_meta($post_id, '_ab_product', true),
        'weight'          => $weight !== '' ? (float) $weight : null,
        'purity'          => $purity !== '' ? (int) $purity : 750,
        'manufactured_at' => (string) get_post_meta($post_id, '_ab_manufactured_at', true),
    ], 200);
}

function arkan_bar_response(array $data, $status)
{
    $response = new WP_REST_Response($data, $status);
    $response->header('Cache-Control', 'no-store');
    return $response;
}
