{{-- Letterhead for every PDF, from Settings → Company. --}}
@php
    use App\Support\Settings;
    $place = collect([Settings::get('company_postcode'), Settings::get('company_city'), Settings::get('company_state')])->filter()->implode(' ');
    $numbers = collect([
        Settings::get('company_registration_no') ? __('Reg. No.').' '.Settings::get('company_registration_no') : null,
        Settings::get('sst_registration_no') ? __('SST No.').' '.Settings::get('sst_registration_no') : null,
    ])->filter()->implode(' · ');
@endphp
<div class="brand">{{ Settings::company() }}</div>
@if ($numbers)<div class="muted" style="font-size: 9.5px;">{{ $numbers }}</div>@endif
@if (Settings::get('company_address'))<div class="muted" style="font-size: 9.5px;">{{ Settings::get('company_address') }}@if ($place), {{ $place }}@endif</div>@endif
@if (Settings::get('company_phone') || Settings::get('company_email'))<div class="muted" style="font-size: 9.5px;">{{ collect([Settings::get('company_phone'), Settings::get('company_email')])->filter()->implode(' · ') }}</div>@endif
