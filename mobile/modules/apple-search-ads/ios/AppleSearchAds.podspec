Pod::Spec.new do |s|
  s.name           = 'AppleSearchAds'
  s.version        = '1.0.0'
  s.summary        = 'Apple Search Ads install attribution token'
  s.description    = 'Returns an AdServices attribution token. The token is exchanged on the server, never sent to analytics.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AdServices'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
