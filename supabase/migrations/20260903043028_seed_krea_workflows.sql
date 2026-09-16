INSERT INTO workflows (name, description, category, app_enabled, icon, workflow_json)
VALUES
  (
    'Krea 2 Image',
    'Krea 2 Large photorealistic image generation with style reference support and weighted negative styles.',
    'image',
    false,
    'ImageIcon',
    '{"3":{"class_type":"KSampler","inputs":{"seed":42,"steps":28,"cfg":6.5,"sampler_name":"dpmpp_2m","scheduler":"karras","denoise":1.0,"model":["10",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},"4":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["10",2]}},"5":{"class_type":"EmptySD3LatentImage","inputs":{"width":1024,"height":1024,"batch_size":1}},"6":{"class_type":"CLIPTextEncode","inputs":{"text":"cinematic, high detail, professional photography, dramatic lighting","clip":["10",1]}},"7":{"class_type":"CLIPTextEncode","inputs":{"text":"low quality, blurry, deformed, watermark, text","clip":["10",1]}},"8":{"class_type":"SaveImage","inputs":{"filename_prefix":"krea_image","images":["4",0]}},"9":{"class_type":"KreaStyleReference","inputs":{"style_weight":0.8,"negative_weight":0.0,"reference_image":null,"model":["10",0]}},"10":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"krea2_large.safetensors"}}}'::jsonb
  ),
  (
    'Krea Video',
    'Krea cinematic video generation with frame interpolation and smooth motion output as animated WEBP.',
    'video',
    false,
    'Film',
    '{"3":{"class_type":"KSampler","inputs":{"seed":42,"steps":30,"cfg":7.0,"sampler_name":"dpmpp_2m","scheduler":"karras","denoise":1.0,"model":["10",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},"4":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["10",2]}},"5":{"class_type":"EmptySD3LatentImage","inputs":{"width":1024,"height":576,"batch_size":8}},"6":{"class_type":"CLIPTextEncode","inputs":{"text":"cinematic video frame, smooth motion, dramatic lighting, film still","clip":["10",1]}},"7":{"class_type":"CLIPTextEncode","inputs":{"text":"low quality, jittery, flickering, watermark, text","clip":["10",1]}},"8":{"class_type":"SaveImage","inputs":{"filename_prefix":"krea_video_frame","images":["4",0]}},"10":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"krea2_large.safetensors"}},"11":{"class_type":"KreaVideoInterpolate","inputs":{"frames":["4",0],"fps":24,"interpolation_mode":"rife"}},"12":{"class_type":"SaveAnimatedWEBP","inputs":{"images":["11",0],"filename_prefix":"krea_video","fps":24.0,"lossless":false,"quality":90,"method":"default"}}}'::jsonb
  ),
  (
    'Krea Enhance',
    'Krea creative image enhancement and 2x upscaling with tile-based processing for high-resolution output.',
    'tool',
    false,
    'Sparkles',
    '{"1":{"class_type":"LoadImage","inputs":{"image":"input.png"}},"2":{"class_type":"KreaEnhance","inputs":{"image":["1",0],"enhance_mode":"creative","creativity":0.4,"resemblance":0.6,"scale":2.0}},"3":{"class_type":"KreaUpscale","inputs":{"image":["2",0],"target_width":2048,"target_height":2048,"tile_size":512,"overlap":64}},"4":{"class_type":"SaveImage","inputs":{"filename_prefix":"krea_enhanced","images":["3",0]}}}'::jsonb
  );
